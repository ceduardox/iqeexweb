from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.schedule import (
    ScheduleSessionCreate,
    ScheduleSessionRead,
    ScheduleSessionStatusUpdate,
    ScheduleSlot,
    ScheduleSummary,
    TutorAssignmentCreate,
    TutorAssignmentRead,
    TutorAvailabilityCreate,
    TutorAvailabilityRead,
    TutorAvailabilityUpdate,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.schedule.schedule import (
    cancel_session,
    create_assignment,
    create_session,
    delete_availability,
    get_schedule_summary,
    list_assignments,
    list_availability,
    list_sessions,
    list_slots,
    update_session_status,
    update_availability,
    upsert_availability,
)


router = APIRouter()


class CancelSessionBody(BaseModel):
    reason: str | None = None


@router.get("/org/{org_id}/summary", response_model=ScheduleSummary)
async def api_get_schedule_summary(
    org_id: int,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await get_schedule_summary(org_id, current_user, db_session)


@router.get("/org/{org_id}/assignments", response_model=list[TutorAssignmentRead])
async def api_list_assignments(
    org_id: int,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await list_assignments(org_id, current_user, db_session)


@router.post("/org/{org_id}/assignments", response_model=TutorAssignmentRead)
async def api_create_assignment(
    org_id: int,
    assignment_create: TutorAssignmentCreate,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await create_assignment(org_id, assignment_create, current_user, db_session)


@router.get("/org/{org_id}/tutors/{tutor_user_id}/availability", response_model=list[TutorAvailabilityRead])
async def api_list_availability(
    org_id: int,
    tutor_user_id: int,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await list_availability(org_id, tutor_user_id, current_user, db_session)


@router.post("/org/{org_id}/availability", response_model=TutorAvailabilityRead)
async def api_upsert_availability(
    org_id: int,
    availability_create: TutorAvailabilityCreate,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await upsert_availability(org_id, availability_create, current_user, db_session)


@router.patch("/org/{org_id}/availability/{availability_uuid}", response_model=TutorAvailabilityRead)
async def api_update_availability(
    org_id: int,
    availability_uuid: str,
    availability_update: TutorAvailabilityUpdate,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await update_availability(org_id, availability_uuid, availability_update, current_user, db_session)


@router.delete("/org/{org_id}/availability/{availability_uuid}", response_model=TutorAvailabilityRead)
async def api_delete_availability(
    org_id: int,
    availability_uuid: str,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await delete_availability(org_id, availability_uuid, current_user, db_session)


@router.get("/org/{org_id}/tutors/{tutor_user_id}/slots", response_model=list[ScheduleSlot])
async def api_list_slots(
    org_id: int,
    tutor_user_id: int,
    from_date: str = Query(...),
    days: int = Query(default=7),
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await list_slots(org_id, tutor_user_id, from_date, days, current_user, db_session)


@router.get("/org/{org_id}/sessions", response_model=list[ScheduleSessionRead])
async def api_list_sessions(
    org_id: int,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await list_sessions(org_id, current_user, db_session)


@router.post("/org/{org_id}/sessions", response_model=ScheduleSessionRead)
async def api_create_session(
    org_id: int,
    session_create: ScheduleSessionCreate,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await create_session(org_id, session_create, current_user, db_session)


@router.post("/org/{org_id}/sessions/{session_uuid}/cancel", response_model=ScheduleSessionRead)
async def api_cancel_session(
    org_id: int,
    session_uuid: str,
    body: CancelSessionBody,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await cancel_session(org_id, session_uuid, body.reason, current_user, db_session)


@router.post("/org/{org_id}/sessions/{session_uuid}/status", response_model=ScheduleSessionRead)
async def api_update_session_status(
    org_id: int,
    session_uuid: str,
    status_update: ScheduleSessionStatusUpdate,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await update_session_status(org_id, session_uuid, status_update, current_user, db_session)
