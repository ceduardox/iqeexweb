import json
import logging
from datetime import datetime
from uuid import uuid4

from fastapi import HTTPException
from sqlmodel import Session, select

from google.genai.types import GenerateContentConfig

from src.db.reading_tests import (
    ReadingAIGenerateRead,
    ReadingAIGenerateRequest,
    ReadingAttempt,
    ReadingAttemptCreate,
    ReadingAttemptRead,
    ReadingMaterial,
    ReadingMaterialCreate,
    ReadingMaterialRead,
    ReadingMaterialStatus,
    ReadingProgramAssignmentRead,
    ReadingProgramUserAssign,
)
from src.db.collections import Collection
from src.db.resource_authors import ResourceAuthor, ResourceAuthorshipEnum, ResourceAuthorshipStatusEnum
from src.db.roles import Role
from src.db.user_organizations import UserOrganization
from src.db.usergroup_resources import UserGroupResource
from src.db.usergroup_user import UserGroupUser
from src.db.usergroups import UserGroup
from src.db.users import PublicUser, User, UserRead
from src.services.ai.base import get_gemini_client
from src.security.rbac.constants import ADMIN_OR_MAINTAINER_ROLE_IDS


logger = logging.getLogger(__name__)


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


def _student_collection_names(org_id: int, user_id: int, db_session: Session) -> list[str]:
    public_collections = db_session.exec(
        select(Collection.name).where(
            Collection.org_id == org_id,
            Collection.public == True,
        )
    ).all()
    assigned_collections = db_session.exec(
        select(Collection.name)
        .join(UserGroupResource, UserGroupResource.resource_uuid == Collection.collection_uuid)  # type: ignore
        .join(
            UserGroupUser,
            UserGroupUser.usergroup_id == UserGroupResource.usergroup_id,
        )  # type: ignore
        .where(
            Collection.org_id == org_id,
            UserGroupResource.org_id == org_id,
            UserGroupUser.org_id == org_id,
            UserGroupUser.user_id == user_id,
        )
    ).all()
    return sorted({name.strip() for name in [*public_collections, *assigned_collections] if name and name.strip()})


def _user_read(user_id: int, db_session: Session) -> UserRead | None:
    user = db_session.get(User, user_id)
    return UserRead.model_validate(user) if user else None


def _is_collection_instructor(collection_uuid: str, user_id: int, db_session: Session) -> bool:
    return bool(
        db_session.exec(
            select(ResourceAuthor).where(
                ResourceAuthor.resource_uuid == collection_uuid,
                ResourceAuthor.user_id == user_id,
                ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
            )
        ).first()
    )


def _require_collection_manager(
    org_id: int,
    collection_uuid: str,
    current_user: PublicUser,
    db_session: Session,
) -> Collection:
    collection = db_session.exec(
        select(Collection).where(
            Collection.org_id == org_id,
            Collection.collection_uuid == collection_uuid,
        )
    ).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Program not found")
    if _is_admin(org_id, current_user.id, db_session) or _is_collection_instructor(collection_uuid, current_user.id, db_session):
        return collection
    raise HTTPException(status_code=403, detail="You can only manage assigned programs")


def _program_group_name(collection: Collection) -> str:
    return f"Programa: {collection.name}"


def _ensure_program_usergroup(collection: Collection, db_session: Session) -> UserGroup:
    linked = db_session.exec(
        select(UserGroup)
        .join(UserGroupResource, UserGroupResource.usergroup_id == UserGroup.id)  # type: ignore
        .where(
            UserGroupResource.org_id == collection.org_id,
            UserGroupResource.resource_uuid == collection.collection_uuid,
        )
    ).first()
    if linked:
        return linked

    group = UserGroup(
        org_id=collection.org_id,
        name=_program_group_name(collection),
        description=f"Alumnos asignados al programa {collection.name}",
        usergroup_uuid=f"usergroup_{uuid4()}",
        creation_date=_now(),
        update_date=_now(),
    )
    db_session.add(group)
    db_session.commit()
    db_session.refresh(group)

    db_session.add(
        UserGroupResource(
            usergroup_id=group.id,
            resource_uuid=collection.collection_uuid,
            org_id=collection.org_id,
            creation_date=_now(),
            update_date=_now(),
        )
    )
    db_session.commit()
    db_session.refresh(group)
    return group


def _program_assignment_read(collection: Collection, db_session: Session) -> ReadingProgramAssignmentRead:
    instructors = db_session.exec(
        select(User)
        .join(ResourceAuthor, ResourceAuthor.user_id == User.id)  # type: ignore
        .where(
            ResourceAuthor.resource_uuid == collection.collection_uuid,
            ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
        )
        .order_by(User.first_name.asc())
    ).all()
    group = db_session.exec(
        select(UserGroup)
        .join(UserGroupResource, UserGroupResource.usergroup_id == UserGroup.id)  # type: ignore
        .where(
            UserGroupResource.org_id == collection.org_id,
            UserGroupResource.resource_uuid == collection.collection_uuid,
        )
    ).first()
    students: list[User] = []
    if group:
        students = db_session.exec(
            select(User)
            .join(UserGroupUser, UserGroupUser.user_id == User.id)  # type: ignore
            .where(
                UserGroupUser.org_id == collection.org_id,
                UserGroupUser.usergroup_id == group.id,
            )
            .order_by(User.first_name.asc())
        ).all()
    return ReadingProgramAssignmentRead(
        id=collection.id,
        collection_uuid=collection.collection_uuid,
        name=collection.name,
        public=collection.public,
        usergroup_id=group.id if group else None,
        instructors=[UserRead.model_validate(user) for user in instructors],
        students=[UserRead.model_validate(user) for user in students],
    )


async def list_program_assignments(
    org_id: int,
    current_user: PublicUser,
    db_session: Session,
) -> list[ReadingProgramAssignmentRead]:
    _require_org_member(org_id, current_user.id, db_session)
    filters = [Collection.org_id == org_id]
    if not _is_admin(org_id, current_user.id, db_session):
        filters.append(Collection.collection_uuid.in_(  # type: ignore
            db_session.exec(
                select(ResourceAuthor.resource_uuid).where(
                    ResourceAuthor.user_id == current_user.id,
                    ResourceAuthor.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE,
                )
            ).all()
        ))
    collections = db_session.exec(select(Collection).where(*filters).order_by(Collection.name.asc())).all()
    return [_program_assignment_read(collection, db_session) for collection in collections]


async def list_program_assignable_users(
    org_id: int,
    current_user: PublicUser,
    db_session: Session,
) -> dict:
    _require_org_member(org_id, current_user.id, db_session)
    if not (_is_admin(org_id, current_user.id, db_session) or _is_instructor(org_id, current_user.id, db_session)):
        raise HTTPException(status_code=403, detail="Only admins or instructors can assign programs")
    rows = db_session.exec(
        select(User, UserOrganization, Role)
        .join(UserOrganization, UserOrganization.user_id == User.id)  # type: ignore
        .join(Role, Role.id == UserOrganization.role_id)  # type: ignore
        .where(UserOrganization.org_id == org_id)
        .order_by(User.first_name.asc())
    ).all()
    instructors = []
    students = []
    for user, membership, role in rows:
        item = UserRead.model_validate(user)
        role_name = (role.name or "").lower()
        if membership.role_id in ADMIN_OR_MAINTAINER_ROLE_IDS or "instructor" in role_name:
            instructors.append(item)
        else:
            students.append(item)
    return {"instructors": instructors, "students": students}


async def assign_program_instructor(
    org_id: int,
    payload: ReadingProgramUserAssign,
    current_user: PublicUser,
    db_session: Session,
) -> ReadingProgramAssignmentRead:
    _require_org_member(org_id, current_user.id, db_session)
    if not _is_admin(org_id, current_user.id, db_session):
        raise HTTPException(status_code=403, detail="Only admins can assign instructors to programs")
    collection = _require_collection_manager(org_id, payload.collection_uuid, current_user, db_session)
    _require_org_member(org_id, payload.user_id, db_session)
    existing = db_session.exec(
        select(ResourceAuthor).where(
            ResourceAuthor.resource_uuid == collection.collection_uuid,
            ResourceAuthor.user_id == payload.user_id,
        )
    ).first()
    if existing:
        existing.authorship = ResourceAuthorshipEnum.MAINTAINER
        existing.authorship_status = ResourceAuthorshipStatusEnum.ACTIVE
        existing.update_date = _now()
        db_session.add(existing)
    else:
        db_session.add(
            ResourceAuthor(
                resource_uuid=collection.collection_uuid,
                user_id=payload.user_id,
                authorship=ResourceAuthorshipEnum.MAINTAINER,
                authorship_status=ResourceAuthorshipStatusEnum.ACTIVE,
                creation_date=_now(),
                update_date=_now(),
            )
        )
    db_session.commit()
    return _program_assignment_read(collection, db_session)


async def assign_program_student(
    org_id: int,
    payload: ReadingProgramUserAssign,
    current_user: PublicUser,
    db_session: Session,
) -> ReadingProgramAssignmentRead:
    _require_org_member(org_id, current_user.id, db_session)
    collection = _require_collection_manager(org_id, payload.collection_uuid, current_user, db_session)
    _require_org_member(org_id, payload.user_id, db_session)
    group = _ensure_program_usergroup(collection, db_session)
    existing = db_session.exec(
        select(UserGroupUser).where(
            UserGroupUser.usergroup_id == group.id,
            UserGroupUser.user_id == payload.user_id,
        )
    ).first()
    if not existing:
        db_session.add(
            UserGroupUser(
                usergroup_id=group.id,
                user_id=payload.user_id,
                org_id=org_id,
                creation_date=_now(),
                update_date=_now(),
            )
        )
        db_session.commit()
    return _program_assignment_read(collection, db_session)


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


def _extract_json_object(text: str) -> dict:
    cleaned = text.strip()
    if "```json" in cleaned:
        start = cleaned.find("```json") + 7
        end = cleaned.find("```", start)
        cleaned = cleaned[start:end].strip() if end != -1 else cleaned[start:].strip()
    elif "```" in cleaned:
        start = cleaned.find("```") + 3
        end = cleaned.find("```", start)
        cleaned = cleaned[start:end].strip() if end != -1 else cleaned[start:].strip()
    if not cleaned.startswith("{"):
        start = cleaned.find("{")
        if start != -1:
            cleaned = cleaned[start:]
    if not cleaned.endswith("}"):
        end = cleaned.rfind("}")
        if end != -1:
            cleaned = cleaned[: end + 1]
    return json.loads(cleaned)


def _normalize_questions(raw_questions: list[dict], desired_count: int) -> list[dict]:
    questions: list[dict] = []
    for item in raw_questions[: max(1, min(desired_count, 10))]:
        q = str(item.get("q") or item.get("question") or "").strip()
        a = str(item.get("a") or item.get("answer") or "").strip()
        choices = item.get("choices") or item.get("options") or []
        if not q or not a or not isinstance(choices, list):
            continue
        normalized_choices = [str(choice).strip() for choice in choices if str(choice).strip()]
        if a not in normalized_choices:
            normalized_choices.insert(0, a)
        normalized_choices = normalized_choices[:4]
        if len(normalized_choices) < 3:
            continue
        questions.append(
            {
                "q": q,
                "a": a,
                "choices": normalized_choices,
                "type": str(item.get("type") or "comprension"),
                "difficulty": str(item.get("difficulty") or "medio"),
            }
        )
    return questions


def _estimated_seconds(words: int, age_min: int, age_max: int) -> int:
    age = (age_min + age_max) / 2
    if age <= 10:
        wpm = 120
    elif age <= 13:
        wpm = 150
    elif age <= 16:
        wpm = 180
    else:
        wpm = 220
    return max(30, round((max(1, words) / wpm) * 60))


async def generate_ai_material(
    org_id: int,
    payload: ReadingAIGenerateRequest,
    current_user: PublicUser,
    db_session: Session,
) -> ReadingAIGenerateRead:
    _require_org_member(org_id, current_user.id, db_session)
    if not _is_instructor(org_id, current_user.id, db_session):
        raise HTTPException(status_code=403, detail="Only admins or instructors can generate reading tests")

    target_words = max(120, min(payload.target_words or 500, 1800))
    question_count = max(3, min(payload.question_count or 6, 10))
    source_text = (payload.source_text or "").strip()
    prompt = (payload.prompt or "").strip()
    if not source_text and not prompt:
        raise HTTPException(status_code=400, detail="Add source text, a PDF, or instructions for the AI")

    instructions = f"""
Genera un test de lectura en espanol para el programa "{payload.program_name}" y edades {payload.age_min}-{payload.age_max}.
Objetivo: crear material pedagogico claro, profesional y evaluable.
Extension aproximada: {target_words} palabras.
Cantidad de preguntas: {question_count}.
Instrucciones del instructor: {prompt or "Usa el texto fuente como base y manten el nivel adecuado."}

Si hay texto fuente, puedes resumirlo, ordenarlo y adaptarlo sin cambiar la idea central:
{source_text[:12000]}

Devuelve SOLO JSON valido con esta forma exacta:
{{
  "title": "titulo corto",
  "description": "objetivo del ejercicio",
  "text_content": "texto completo para que lea el alumno",
  "questions": [
    {{
      "q": "pregunta",
      "a": "respuesta correcta exacta",
      "choices": ["opcion correcta", "distractor", "distractor"],
      "type": "literal|inferencial|vocabulario|idea principal",
      "difficulty": "facil|medio|avanzado"
    }}
  ]
}}
"""

    try:
        client = get_gemini_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[{"role": "user", "parts": [{"text": instructions}]}],
            config=GenerateContentConfig(response_mime_type="application/json", temperature=0.45),
        )
        data = _extract_json_object(response.text or "")
    except Exception as exc:
        logger.exception("Failed to generate reading test with AI")
        raise HTTPException(status_code=503, detail=f"AI generation failed: {str(exc)}")

    text_content = str(data.get("text_content") or "").strip()
    questions = _normalize_questions(data.get("questions") or [], question_count)
    if not text_content or len(questions) < 3:
        raise HTTPException(status_code=502, detail="AI response did not include enough reading content or questions")

    words = len(text_content.split())
    return ReadingAIGenerateRead(
        title=str(data.get("title") or payload.title or "Lectura generada con IA").strip(),
        description=str(data.get("description") or "Material generado con IA para revision del instructor").strip(),
        program_name=payload.program_name,
        age_min=payload.age_min,
        age_max=payload.age_max,
        text_content=text_content,
        questions=questions,
        estimated_reading_seconds=_estimated_seconds(words, payload.age_min, payload.age_max),
        source="ai",
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
        collection_names = _student_collection_names(org_id, current_user.id, db_session)
        if not collection_names:
            return []
        filters.append(ReadingMaterial.program_name.in_(collection_names))  # type: ignore
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
