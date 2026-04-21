import pytest
import sys
import types
from fastapi import HTTPException
from unittest.mock import AsyncMock, Mock, patch

sys.modules.setdefault("resend", Mock())
sys.modules.setdefault("stripe", Mock())

pwdlib_module = types.ModuleType("pwdlib")
pwdlib_hashers_module = types.ModuleType("pwdlib.hashers")
pwdlib_argon2_module = types.ModuleType("pwdlib.hashers.argon2")


class DummyPasswordHash:
    def __init__(self, *args, **kwargs):
        pass


class DummyArgon2Hasher:
    def __init__(self, *args, **kwargs):
        pass


pwdlib_module.PasswordHash = DummyPasswordHash
pwdlib_argon2_module.Argon2Hasher = DummyArgon2Hasher

sys.modules.setdefault("pwdlib", pwdlib_module)
sys.modules.setdefault("pwdlib.hashers", pwdlib_hashers_module)
sys.modules.setdefault("pwdlib.hashers.argon2", pwdlib_argon2_module)

from ee.db.payments.payments_enrollments import EnrollmentStatusEnum
from ee.routers.payments import (
    AdminEnrollmentCreate,
    AdminEnrollmentStatusUpdate,
    api_create_admin_enrollment,
    api_update_admin_enrollment_status,
)


class ExecResult:
    def __init__(self, value):
        self.value = value

    def first(self):
        return self.value


@pytest.mark.asyncio
async def test_api_create_admin_enrollment_rejects_user_outside_org():
    request = Mock()
    current_user = Mock(id=99)
    db_session = Mock()
    db_session.exec.return_value = ExecResult(None)

    payload = AdminEnrollmentCreate(
        offer_id=7,
        user_id=15,
        status=EnrollmentStatusEnum.ACTIVE,
    )

    with (
        patch("ee.routers.payments.require_org_admin_access", new=AsyncMock()),
        patch("ee.routers.payments.create_enrollment", new=AsyncMock()) as mock_create,
    ):
        with pytest.raises(HTTPException) as exc_info:
            await api_create_admin_enrollment(
                request=request,
                org_id=3,
                payload=payload,
                current_user=current_user,
                db_session=db_session,
            )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "User does not belong to this organization"
    mock_create.assert_not_awaited()


@pytest.mark.asyncio
async def test_api_create_admin_enrollment_marks_source_as_admin_manual():
    request = Mock()
    current_user = Mock(id=99)
    db_session = Mock()
    db_session.exec.return_value = ExecResult(Mock())

    payload = AdminEnrollmentCreate(
        offer_id=7,
        user_id=15,
        status=EnrollmentStatusEnum.ACTIVE,
    )
    created_enrollment = Mock(id=44, status=EnrollmentStatusEnum.ACTIVE)

    with (
        patch("ee.routers.payments.require_org_admin_access", new=AsyncMock()),
        patch(
            "ee.routers.payments.create_enrollment",
            new=AsyncMock(return_value=created_enrollment),
        ) as mock_create,
    ):
        result = await api_create_admin_enrollment(
            request=request,
            org_id=3,
            payload=payload,
            current_user=current_user,
            db_session=db_session,
        )

    assert result == {
        "message": "Enrollment created successfully",
        "enrollment_id": 44,
        "status": EnrollmentStatusEnum.ACTIVE,
    }
    mock_create.assert_awaited_once()
    kwargs = mock_create.await_args.kwargs
    assert kwargs["provider_data"]["source"] == "admin_manual"
    assert kwargs["provider_data"]["assigned_by_user_id"] == 99


@pytest.mark.asyncio
async def test_api_update_admin_enrollment_status_delegates_to_service():
    request = Mock()
    current_user = Mock(id=99)
    db_session = Mock()
    updated_enrollment = Mock(id=55, status=EnrollmentStatusEnum.CANCELLED)

    with (
        patch("ee.routers.payments.require_org_admin_access", new=AsyncMock()),
        patch(
            "ee.routers.payments.update_enrollment_status",
            new=AsyncMock(return_value=updated_enrollment),
        ) as mock_update,
    ):
        result = await api_update_admin_enrollment_status(
            request=request,
            org_id=3,
            enrollment_id=55,
            payload=AdminEnrollmentStatusUpdate(status=EnrollmentStatusEnum.CANCELLED),
            current_user=current_user,
            db_session=db_session,
        )

    assert result == {
        "message": "Enrollment updated successfully",
        "enrollment_id": 55,
        "status": EnrollmentStatusEnum.CANCELLED,
    }
    mock_update.assert_awaited_once()
