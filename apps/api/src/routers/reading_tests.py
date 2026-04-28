from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.reading_tests import (
    ReadingAttemptCreate,
    ReadingAttemptRead,
    ReadingMaterialCreate,
    ReadingMaterialRead,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.reading_tests.reading_tests import (
    create_attempt,
    create_material,
    list_attempts,
    list_materials,
)


router = APIRouter()


@router.get("/org/{org_id}/materials", response_model=list[ReadingMaterialRead])
async def api_list_materials(
    org_id: int,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await list_materials(org_id, current_user, db_session)


@router.post("/org/{org_id}/materials", response_model=ReadingMaterialRead)
async def api_create_material(
    org_id: int,
    material_create: ReadingMaterialCreate,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await create_material(org_id, material_create, current_user, db_session)


@router.get("/org/{org_id}/attempts", response_model=list[ReadingAttemptRead])
async def api_list_attempts(
    org_id: int,
    material_id: int | None = Query(default=None),
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await list_attempts(org_id, material_id, current_user, db_session)


@router.post("/org/{org_id}/attempts", response_model=ReadingAttemptRead)
async def api_create_attempt(
    org_id: int,
    attempt_create: ReadingAttemptCreate,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await create_attempt(org_id, attempt_create, current_user, db_session)
