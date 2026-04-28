from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import HTTPException
from sqlmodel import Session, select, or_

from src.db.roles import Role
from src.db.schedule import (
    ScheduleNotification,
    ScheduleNotificationRead,
    ScheduleNotificationType,
    ScheduleSession,
    ScheduleSessionCreate,
    ScheduleSessionRead,
    ScheduleSessionStatus,
    ScheduleSessionStatusUpdate,
    ScheduleSlot,
    ScheduleSummary,
    TutorAssignment,
    TutorAssignmentCreate,
    TutorAssignmentRead,
    TutorAvailability,
    TutorAvailabilityCreate,
    TutorAvailabilityRead,
)
from src.db.user_organizations import UserOrganization
from src.db.users import PublicUser, User, UserRead
from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS


def _now() -> str:
    return datetime.utcnow().isoformat()


def _parse_dt(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid datetime")


def _user_membership(org_id: int, user_id: int, db_session: Session) -> UserOrganization | None:
    return db_session.exec(
        select(UserOrganization).where(
            UserOrganization.org_id == org_id,
            UserOrganization.user_id == user_id,
        )
    ).first()


def _require_org_member(org_id: int, user_id: int, db_session: Session) -> UserOrganization:
    membership = _user_membership(org_id, user_id, db_session)
    if not membership:
        raise HTTPException(status_code=403, detail="User is not a member of this organization")
    return membership


def _is_admin(org_id: int, user_id: int, db_session: Session) -> bool:
    membership = _user_membership(org_id, user_id, db_session)
    return bool(membership and membership.role_id in ADMIN_OR_MAINTAINER_ROLE_IDS)


def _is_tutor(org_id: int, user_id: int, db_session: Session) -> bool:
    membership = _user_membership(org_id, user_id, db_session)
    if not membership:
        return False
    role = db_session.get(Role, membership.role_id)
    if not role:
        return False
    rights = role.rights or {}
    dashboard = rights.get("dashboard") if isinstance(rights, dict) else None
    courses = rights.get("courses") if isinstance(rights, dict) else None
    return bool(
        membership.role_id in ADMIN_OR_MAINTAINER_ROLE_IDS
        or dashboard and dashboard.get("action_access")
        or courses and courses.get("action_create")
    )


def _user_read(user_id: int, db_session: Session) -> UserRead:
    user = db_session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserRead.model_validate(user)


def _assignment_exists(org_id: int, tutor_user_id: int, student_user_id: int, db_session: Session) -> bool:
    return bool(
        db_session.exec(
            select(TutorAssignment).where(
                TutorAssignment.org_id == org_id,
                TutorAssignment.tutor_user_id == tutor_user_id,
                TutorAssignment.student_user_id == student_user_id,
                TutorAssignment.active == True,  # noqa: E712
            )
        ).first()
    )


def _session_read(session: ScheduleSession, db_session: Session) -> ScheduleSessionRead:
    return ScheduleSessionRead(
        **session.model_dump(),
        tutor=_user_read(session.tutor_user_id, db_session),
        student=_user_read(session.student_user_id, db_session),
        status_marked_by=_user_read(session.status_marked_by_id, db_session) if session.status_marked_by_id else None,
    )


def ensure_schedule_schema(db_session: Session) -> None:
    bind = db_session.get_bind()
    if not bind:
        return

    dialect = bind.dialect.name
    table_name = ScheduleSession.__table__.name
    quoted_table = f'"{table_name}"' if dialect == "postgresql" else table_name

    if dialect == "postgresql":
        statements = [
            f'ALTER TABLE {quoted_table} ADD COLUMN IF NOT EXISTS status_marked_by_id INTEGER',
            f'ALTER TABLE {quoted_table} ADD COLUMN IF NOT EXISTS status_marked_at VARCHAR',
            f'ALTER TABLE {quoted_table} ADD COLUMN IF NOT EXISTS instructor_notes VARCHAR',
        ]
    else:
        statements = [
            f'ALTER TABLE {quoted_table} ADD COLUMN status_marked_by_id INTEGER',
            f'ALTER TABLE {quoted_table} ADD COLUMN status_marked_at VARCHAR',
            f'ALTER TABLE {quoted_table} ADD COLUMN instructor_notes VARCHAR',
        ]

    from sqlalchemy import text

    for statement in statements:
        try:
            db_session.execute(text(statement))
            db_session.commit()
        except Exception:
            db_session.rollback()


def _assignment_read(assignment: TutorAssignment, db_session: Session) -> TutorAssignmentRead:
    return TutorAssignmentRead(
        **assignment.model_dump(),
        tutor=_user_read(assignment.tutor_user_id, db_session),
        student=_user_read(assignment.student_user_id, db_session),
    )


def _notify(
    db_session: Session,
    org_id: int,
    user_id: int,
    notification_type: ScheduleNotificationType,
    title: str,
    body: str,
    session_uuid: str,
) -> None:
    notification = ScheduleNotification(
        notification_uuid=f"schedule_notification_{uuid4()}",
        org_id=org_id,
        user_id=user_id,
        type=notification_type,
        title=title,
        body=body,
        session_uuid=session_uuid,
        creation_date=_now(),
    )
    db_session.add(notification)


async def get_schedule_summary(
    org_id: int,
    current_user: PublicUser,
    db_session: Session,
) -> ScheduleSummary:
    _require_org_member(org_id, current_user.id, db_session)
    is_admin = _is_admin(org_id, current_user.id, db_session)
    is_tutor = _is_tutor(org_id, current_user.id, db_session)

    tutor_rows = db_session.exec(
        select(TutorAssignment).where(
            TutorAssignment.org_id == org_id,
            TutorAssignment.student_user_id == current_user.id,
            TutorAssignment.active == True,  # noqa: E712
        )
    ).all()
    assigned_tutors = [_user_read(row.tutor_user_id, db_session) for row in tutor_rows]

    session_filter = [ScheduleSession.org_id == org_id, ScheduleSession.status == ScheduleSessionStatus.SCHEDULED]
    if not is_admin:
        session_filter.append(
            or_(
                ScheduleSession.student_user_id == current_user.id,
                ScheduleSession.tutor_user_id == current_user.id,
            )
        )
    sessions = db_session.exec(
        select(ScheduleSession)
        .where(*session_filter)
        .order_by(ScheduleSession.starts_at.asc())
        .limit(8)
    ).all()

    notifications = db_session.exec(
        select(ScheduleNotification)
        .where(ScheduleNotification.org_id == org_id, ScheduleNotification.user_id == current_user.id)
        .order_by(ScheduleNotification.id.desc())
        .limit(8)
    ).all()

    return ScheduleSummary(
        is_admin=is_admin,
        is_tutor=is_tutor,
        assigned_tutors=assigned_tutors,
        upcoming_sessions=[_session_read(session, db_session) for session in sessions],
        notifications=[ScheduleNotificationRead.model_validate(notification) for notification in notifications],
    )


async def list_assignments(org_id: int, current_user: PublicUser, db_session: Session) -> list[TutorAssignmentRead]:
    _require_org_member(org_id, current_user.id, db_session)
    if _is_admin(org_id, current_user.id, db_session):
        rows = db_session.exec(select(TutorAssignment).where(TutorAssignment.org_id == org_id)).all()
    elif _is_tutor(org_id, current_user.id, db_session):
        rows = db_session.exec(
            select(TutorAssignment).where(
                TutorAssignment.org_id == org_id,
                TutorAssignment.tutor_user_id == current_user.id,
            )
        ).all()
    else:
        rows = db_session.exec(
            select(TutorAssignment).where(
                TutorAssignment.org_id == org_id,
                TutorAssignment.student_user_id == current_user.id,
            )
        ).all()
    return [_assignment_read(row, db_session) for row in rows]


async def create_assignment(
    org_id: int,
    assignment_create: TutorAssignmentCreate,
    current_user: PublicUser,
    db_session: Session,
) -> TutorAssignmentRead:
    if not _is_admin(org_id, current_user.id, db_session):
        raise HTTPException(status_code=403, detail="Only admins can assign tutors")
    _require_org_member(org_id, assignment_create.tutor_user_id, db_session)
    _require_org_member(org_id, assignment_create.student_user_id, db_session)

    existing = db_session.exec(
        select(TutorAssignment).where(
            TutorAssignment.org_id == org_id,
            TutorAssignment.tutor_user_id == assignment_create.tutor_user_id,
            TutorAssignment.student_user_id == assignment_create.student_user_id,
        )
    ).first()
    if existing:
        existing.active = assignment_create.active
        existing.course_id = assignment_create.course_id
        existing.update_date = _now()
        db_session.add(existing)
        db_session.commit()
        db_session.refresh(existing)
        return _assignment_read(existing, db_session)

    assignment = TutorAssignment(
        **assignment_create.model_dump(),
        org_id=org_id,
        assignment_uuid=f"tutor_assignment_{uuid4()}",
        created_by_id=current_user.id,
        creation_date=_now(),
        update_date=_now(),
    )
    db_session.add(assignment)
    db_session.commit()
    db_session.refresh(assignment)
    return _assignment_read(assignment, db_session)


async def list_availability(
    org_id: int,
    tutor_user_id: int,
    current_user: PublicUser,
    db_session: Session,
) -> list[TutorAvailabilityRead]:
    _require_org_member(org_id, current_user.id, db_session)
    if not (_is_admin(org_id, current_user.id, db_session) or tutor_user_id == current_user.id or _assignment_exists(org_id, tutor_user_id, current_user.id, db_session)):
        raise HTTPException(status_code=403, detail="Not allowed to view this availability")

    rows = db_session.exec(
        select(TutorAvailability).where(
            TutorAvailability.org_id == org_id,
            TutorAvailability.tutor_user_id == tutor_user_id,
            TutorAvailability.active == True,  # noqa: E712
        )
    ).all()
    return [TutorAvailabilityRead.model_validate(row) for row in rows]


async def upsert_availability(
    org_id: int,
    availability_create: TutorAvailabilityCreate,
    current_user: PublicUser,
    db_session: Session,
) -> TutorAvailabilityRead:
    _require_org_member(org_id, current_user.id, db_session)
    if not (_is_admin(org_id, current_user.id, db_session) or availability_create.tutor_user_id == current_user.id):
        raise HTTPException(status_code=403, detail="Not allowed to update this availability")

    availability = TutorAvailability(
        **availability_create.model_dump(),
        org_id=org_id,
        availability_uuid=f"tutor_availability_{uuid4()}",
        creation_date=_now(),
        update_date=_now(),
    )
    db_session.add(availability)
    db_session.commit()
    db_session.refresh(availability)
    return TutorAvailabilityRead.model_validate(availability)


async def list_slots(
    org_id: int,
    tutor_user_id: int,
    from_date: str,
    days: int,
    current_user: PublicUser,
    db_session: Session,
) -> list[ScheduleSlot]:
    await list_availability(org_id, tutor_user_id, current_user, db_session)
    start_day = datetime.fromisoformat(from_date).date()
    days = min(max(days, 1), 31)

    availability = db_session.exec(
        select(TutorAvailability).where(
            TutorAvailability.org_id == org_id,
            TutorAvailability.tutor_user_id == tutor_user_id,
            TutorAvailability.active == True,  # noqa: E712
        )
    ).all()

    if not availability:
        availability = [
            TutorAvailability(
                org_id=org_id,
                tutor_user_id=tutor_user_id,
                weekday=weekday,
                start_time="09:00",
                end_time="17:00",
                slot_minutes=30,
                timezone="UTC",
                active=True,
            )
            for weekday in range(0, 5)
        ]

    sessions = db_session.exec(
        select(ScheduleSession).where(
            ScheduleSession.org_id == org_id,
            ScheduleSession.tutor_user_id == tutor_user_id,
            ScheduleSession.status != ScheduleSessionStatus.CANCELLED,
        )
    ).all()

    slots: list[ScheduleSlot] = []
    for offset in range(days):
        day = start_day + timedelta(days=offset)
        for item in [row for row in availability if row.weekday == day.weekday()]:
            start_hour, start_minute = [int(part) for part in item.start_time.split(":")[:2]]
            end_hour, end_minute = [int(part) for part in item.end_time.split(":")[:2]]
            cursor = datetime.combine(day, datetime.min.time()).replace(hour=start_hour, minute=start_minute)
            end = datetime.combine(day, datetime.min.time()).replace(hour=end_hour, minute=end_minute)
            while cursor + timedelta(minutes=item.slot_minutes) <= end:
                slot_end = cursor + timedelta(minutes=item.slot_minutes)
                is_taken = any(
                    _parse_dt(session.starts_at) < slot_end and cursor < _parse_dt(session.ends_at)
                    for session in sessions
                )
                slots.append(ScheduleSlot(starts_at=cursor.isoformat(), ends_at=slot_end.isoformat(), available=not is_taken))
                cursor = slot_end
    return slots


async def list_sessions(org_id: int, current_user: PublicUser, db_session: Session) -> list[ScheduleSessionRead]:
    _require_org_member(org_id, current_user.id, db_session)
    filters = [ScheduleSession.org_id == org_id]
    if not _is_admin(org_id, current_user.id, db_session):
        filters.append(
            or_(
                ScheduleSession.student_user_id == current_user.id,
                ScheduleSession.tutor_user_id == current_user.id,
            )
        )
    rows = db_session.exec(select(ScheduleSession).where(*filters).order_by(ScheduleSession.starts_at.asc())).all()
    return [_session_read(row, db_session) for row in rows]


async def create_session(
    org_id: int,
    session_create: ScheduleSessionCreate,
    current_user: PublicUser,
    db_session: Session,
) -> ScheduleSessionRead:
    _require_org_member(org_id, current_user.id, db_session)
    _require_org_member(org_id, session_create.tutor_user_id, db_session)

    if not (_is_admin(org_id, current_user.id, db_session) or _assignment_exists(org_id, session_create.tutor_user_id, current_user.id, db_session)):
        raise HTTPException(status_code=403, detail="You can only book assigned tutors")

    starts_at = _parse_dt(session_create.starts_at)
    ends_at = _parse_dt(session_create.ends_at)
    if ends_at <= starts_at:
        raise HTTPException(status_code=400, detail="Session end must be after start")

    overlapping = db_session.exec(
        select(ScheduleSession).where(
            ScheduleSession.org_id == org_id,
            ScheduleSession.tutor_user_id == session_create.tutor_user_id,
            ScheduleSession.status != ScheduleSessionStatus.CANCELLED,
        )
    ).all()
    for session in overlapping:
        if _parse_dt(session.starts_at) < ends_at and starts_at < _parse_dt(session.ends_at):
            raise HTTPException(status_code=409, detail="This tutor already has a reservation at that time")

    session = ScheduleSession(
        **session_create.model_dump(),
        org_id=org_id,
        student_user_id=current_user.id,
        session_uuid=f"tutoring_session_{uuid4()}",
        created_by_id=current_user.id,
        creation_date=_now(),
        update_date=_now(),
    )
    db_session.add(session)
    db_session.flush()
    _notify(
        db_session,
        org_id,
        session.tutor_user_id,
        ScheduleNotificationType.SESSION_BOOKED,
        "Nueva reserva de tutoría",
        f"{current_user.username} reservó una tutoría.",
        session.session_uuid,
    )
    db_session.commit()
    db_session.refresh(session)
    return _session_read(session, db_session)


async def cancel_session(
    org_id: int,
    session_uuid: str,
    reason: str | None,
    current_user: PublicUser,
    db_session: Session,
) -> ScheduleSessionRead:
    _require_org_member(org_id, current_user.id, db_session)
    session = db_session.exec(
        select(ScheduleSession).where(ScheduleSession.org_id == org_id, ScheduleSession.session_uuid == session_uuid)
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not (_is_admin(org_id, current_user.id, db_session) or current_user.id in [session.student_user_id, session.tutor_user_id]):
        raise HTTPException(status_code=403, detail="Not allowed to cancel this session")
    session.status = ScheduleSessionStatus.CANCELLED
    session.cancellation_reason = reason or ""
    session.update_date = _now()
    db_session.add(session)
    target_user_id = session.student_user_id if current_user.id == session.tutor_user_id else session.tutor_user_id
    _notify(
        db_session,
        org_id,
        target_user_id,
        ScheduleNotificationType.SESSION_CANCELLED,
        "Tutoría cancelada",
        "Una tutoría fue cancelada.",
        session.session_uuid,
    )
    db_session.commit()
    db_session.refresh(session)
    return _session_read(session, db_session)


async def update_session_status(
    org_id: int,
    session_uuid: str,
    status_update: ScheduleSessionStatusUpdate,
    current_user: PublicUser,
    db_session: Session,
) -> ScheduleSessionRead:
    _require_org_member(org_id, current_user.id, db_session)
    session = db_session.exec(
        select(ScheduleSession).where(ScheduleSession.org_id == org_id, ScheduleSession.session_uuid == session_uuid)
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if status_update.status not in [ScheduleSessionStatus.COMPLETED, ScheduleSessionStatus.NO_SHOW, ScheduleSessionStatus.SCHEDULED]:
        raise HTTPException(status_code=400, detail="Invalid status for this action")

    if not (_is_admin(org_id, current_user.id, db_session) or current_user.id == session.tutor_user_id):
        raise HTTPException(status_code=403, detail="Only the tutor or an admin can mark this session")

    session.status = status_update.status
    session.status_marked_by_id = current_user.id
    session.status_marked_at = _now()
    session.instructor_notes = status_update.instructor_notes or ""
    session.update_date = _now()
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)
    return _session_read(session, db_session)
