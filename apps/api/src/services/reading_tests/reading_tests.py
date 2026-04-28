from datetime import datetime
from uuid import uuid4

from fastapi import HTTPException
from sqlmodel import Session, select

from src.db.reading_tests import (
    ReadingAttempt,
    ReadingAttemptCreate,
    ReadingAttemptRead,
    ReadingMaterial,
    ReadingMaterialCreate,
    ReadingMaterialRead,
    ReadingMaterialStatus,
)
from src.db.roles import Role
from src.db.user_organizations import UserOrganization
from src.db.users import PublicUser, User, UserRead
from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS


def _now() -> str:
    return datetime.utcnow().isoformat()


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


def _is_instructor(org_id: int, user_id: int, db_session: Session) -> bool:
    membership = _user_membership(org_id, user_id, db_session)
    if not membership:
        return False
    if membership.role_id in ADMIN_OR_MAINTAINER_ROLE_IDS:
        return True
    role = db_session.get(Role, membership.role_id)
    rights = role.rights if role else {}
    dashboard = rights.get("dashboard") if isinstance(rights, dict) else None
    courses = rights.get("courses") if isinstance(rights, dict) else None
    return bool(dashboard and dashboard.get("action_access") or courses and courses.get("action_create"))


def _user_read(user_id: int, db_session: Session) -> UserRead | None:
    user = db_session.get(User, user_id)
    return UserRead.model_validate(user) if user else None


def _material_read(material: ReadingMaterial, db_session: Session) -> ReadingMaterialRead:
    return ReadingMaterialRead(
        **material.model_dump(),
        creator=_user_read(material.created_by_id, db_session),
    )


def _attempt_read(attempt: ReadingAttempt, db_session: Session) -> ReadingAttemptRead:
    material = db_session.get(ReadingMaterial, attempt.material_id)
    return ReadingAttemptRead(
        **attempt.model_dump(),
        material=_material_read(material, db_session) if material else None,
        student=_user_read(attempt.student_user_id, db_session),
    )


async def list_materials(
    org_id: int,
    current_user: PublicUser,
    db_session: Session,
) -> list[ReadingMaterialRead]:
    _require_org_member(org_id, current_user.id, db_session)
    filters = [ReadingMaterial.org_id == org_id]
    if not _is_instructor(org_id, current_user.id, db_session):
        filters.append(ReadingMaterial.status == ReadingMaterialStatus.PUBLISHED)
    rows = db_session.exec(
        select(ReadingMaterial).where(*filters).order_by(ReadingMaterial.id.desc())
    ).all()
    return [_material_read(row, db_session) for row in rows]


async def create_material(
    org_id: int,
    material_create: ReadingMaterialCreate,
    current_user: PublicUser,
    db_session: Session,
) -> ReadingMaterialRead:
    _require_org_member(org_id, current_user.id, db_session)
    if not _is_instructor(org_id, current_user.id, db_session):
        raise HTTPException(status_code=403, detail="Only admins or instructors can create reading materials")
    if not material_create.title.strip() or not material_create.text_content.strip():
        raise HTTPException(status_code=400, detail="Title and text are required")

    material = ReadingMaterial(
        **material_create.model_dump(),
        org_id=org_id,
        material_uuid=f"reading_material_{uuid4()}",
        created_by_id=current_user.id,
        creation_date=_now(),
        update_date=_now(),
    )
    db_session.add(material)
    db_session.commit()
    db_session.refresh(material)
    return _material_read(material, db_session)


async def list_attempts(
    org_id: int,
    material_id: int | None,
    current_user: PublicUser,
    db_session: Session,
) -> list[ReadingAttemptRead]:
    _require_org_member(org_id, current_user.id, db_session)
    filters = [ReadingAttempt.org_id == org_id]
    if material_id:
        filters.append(ReadingAttempt.material_id == material_id)
    if not _is_instructor(org_id, current_user.id, db_session):
        filters.append(ReadingAttempt.student_user_id == current_user.id)
    rows = db_session.exec(
        select(ReadingAttempt).where(*filters).order_by(ReadingAttempt.id.asc())
    ).all()
    return [_attempt_read(row, db_session) for row in rows]


async def create_attempt(
    org_id: int,
    attempt_create: ReadingAttemptCreate,
    current_user: PublicUser,
    db_session: Session,
) -> ReadingAttemptRead:
    _require_org_member(org_id, current_user.id, db_session)
    material = db_session.get(ReadingMaterial, attempt_create.material_id)
    if not material or material.org_id != org_id:
        raise HTTPException(status_code=404, detail="Reading material not found")
    if material.status != ReadingMaterialStatus.PUBLISHED and not _is_instructor(org_id, current_user.id, db_session):
        raise HTTPException(status_code=403, detail="Reading material is not published")

    attempt = ReadingAttempt(
        **attempt_create.model_dump(),
        org_id=org_id,
        student_user_id=current_user.id,
        attempt_uuid=f"reading_attempt_{uuid4()}",
        creation_date=_now(),
    )
    db_session.add(attempt)
    db_session.commit()
    db_session.refresh(attempt)
    return _attempt_read(attempt, db_session)
