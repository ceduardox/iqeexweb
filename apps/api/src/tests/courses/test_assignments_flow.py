import pytest
from fastapi import HTTPException
from unittest.mock import AsyncMock, Mock, patch

from src.db.courses.assignments import (
    AssignmentCreate,
    AssignmentUserSubmission,
    AssignmentUserSubmissionStatus,
    AssignmentUserSubmissionUpdate,
    GradingTypeEnum,
)
from src.services.courses.activities.assignments import (
    create_assignment,
    update_assignment_submission,
)


class ExecResult:
    def __init__(self, value):
        self.value = value

    def first(self):
        return self.value

    def all(self):
        if self.value is None:
            return []
        if isinstance(self.value, list):
            return self.value
        return [self.value]


class TestAssignmentsFlow:
    @pytest.mark.asyncio
    async def test_create_assignment_rejects_chapter_outside_course(self):
        request = Mock()
        current_user = Mock()
        course = Mock(id=1, course_uuid="course_valid", org_id=10)
        chapter = Mock(id=2, course_id=999)
        activity = Mock(id=3, course_id=1)

        db_session = Mock()
        db_session.exec.side_effect = [
            ExecResult(course),
            ExecResult(chapter),
            ExecResult(activity),
        ]

        assignment_object = AssignmentCreate(
            title="Essay",
            description="Write an essay",
            due_date="2026-04-20",
            published=False,
            grading_type=GradingTypeEnum.ALPHABET,
            org_id=10,
            course_id=1,
            chapter_id=2,
            activity_id=3,
        )

        with (
            patch(
                "src.services.courses.activities.assignments.check_resource_access",
                new=AsyncMock(),
            ) as mock_access,
            patch(
                "src.services.courses.activities.assignments.check_limits_with_usage"
            ) as mock_limits,
            patch(
                "src.services.courses.activities.assignments.increase_feature_usage"
            ) as mock_increase,
        ):
            with pytest.raises(HTTPException) as exc_info:
                await create_assignment(
                    request, assignment_object, current_user, db_session
                )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == "Chapter does not belong to course"
        mock_access.assert_awaited_once()
        mock_limits.assert_not_called()
        mock_increase.assert_not_called()

    @pytest.mark.asyncio
    async def test_update_assignment_submission_scopes_by_assignment_uuid(self):
        request = Mock()
        current_user = Mock(id=7)
        target_assignment = Mock(id=10, course_id=42, assignment_uuid="assignment_target")
        wrong_assignment = Mock(id=999, course_id=42, assignment_uuid="assignment_wrong")
        course = Mock(id=42, course_uuid="course_target")

        target_submission = AssignmentUserSubmission(
            id=1,
            creation_date="2026-04-20",
            update_date="2026-04-20",
            assignmentusersubmission_uuid="assignmentusersubmission_target",
            submission_status=AssignmentUserSubmissionStatus.SUBMITTED,
            grade=0,
            user_id=7,
            assignment_id=10,
        )
        wrong_submission = AssignmentUserSubmission(
            id=2,
            creation_date="2026-04-20",
            update_date="2026-04-20",
            assignmentusersubmission_uuid="assignmentusersubmission_wrong",
            submission_status=AssignmentUserSubmissionStatus.SUBMITTED,
            grade=0,
            user_id=7,
            assignment_id=999,
        )

        db_session = Mock()

        def exec_side_effect(statement):
            sql = str(statement)
            if "assignment.assignment_uuid" in sql:
                return ExecResult(target_assignment)
            if (
                "assignmentusersubmission.user_id" in sql
                and "assignmentusersubmission.assignment_id" in sql
            ):
                return ExecResult(target_submission)
            if "assignmentusersubmission.user_id" in sql:
                return ExecResult(wrong_submission)
            if "assignment.id" in sql:
                return ExecResult(wrong_assignment)
            if "course.id" in sql:
                return ExecResult(course)
            raise AssertionError(f"Unexpected query: {sql}")

        db_session.exec.side_effect = exec_side_effect

        update_object = AssignmentUserSubmissionUpdate(
            submission_status=AssignmentUserSubmissionStatus.GRADED
        )

        with (
            patch(
                "src.services.courses.activities.assignments.authorization_verify_based_on_roles",
                new=AsyncMock(return_value=False),
            ),
            patch(
                "src.services.courses.activities.assignments.check_resource_access",
                new=AsyncMock(),
            ),
        ):
            result = await update_assignment_submission(
                request,
                "assignment_target",
                "7",
                update_object,
                current_user,
                db_session,
            )

        assert result.assignment_id == 10
        assert (
            target_submission.submission_status
            == AssignmentUserSubmissionStatus.GRADED
        )
        assert (
            wrong_submission.submission_status
            == AssignmentUserSubmissionStatus.SUBMITTED
        )
        db_session.add.assert_called_with(target_submission)
