from io import BytesIO

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlmodel import Session
from pypdf import PdfReader

from src.core.events.database import get_db_session
from src.db.reading_tests import (
    ReadingAIGenerateRead,
    ReadingAIGenerateRequest,
    ReadingAttemptCreate,
    ReadingAttemptRead,
    ReadingMaterialCreate,
    ReadingMaterialRead,
    ReadingProgramAssignmentRead,
    ReadingProgramUserAssign,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.reading_tests.reading_tests import (
    create_attempt,
    create_material,
    assign_program_instructor,
    assign_program_student,
    generate_ai_material,
    list_program_assignable_users,
    list_program_assignments,
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


@router.get("/org/{org_id}/program-assignments", response_model=list[ReadingProgramAssignmentRead])
async def api_list_program_assignments(
    org_id: int,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await list_program_assignments(org_id, current_user, db_session)


@router.get("/org/{org_id}/program-assignable-users")
async def api_list_program_assignable_users(
    org_id: int,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await list_program_assignable_users(org_id, current_user, db_session)


@router.post("/org/{org_id}/program-assignments/instructors", response_model=ReadingProgramAssignmentRead)
async def api_assign_program_instructor(
    org_id: int,
    payload: ReadingProgramUserAssign,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await assign_program_instructor(org_id, payload, current_user, db_session)


@router.post("/org/{org_id}/program-assignments/students", response_model=ReadingProgramAssignmentRead)
async def api_assign_program_student(
    org_id: int,
    payload: ReadingProgramUserAssign,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await assign_program_student(org_id, payload, current_user, db_session)


@router.post("/org/{org_id}/generate", response_model=ReadingAIGenerateRead)
async def api_generate_material(
    org_id: int,
    generate_request: ReadingAIGenerateRequest,
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    return await generate_ai_material(org_id, generate_request, current_user, db_session)


@router.post("/org/{org_id}/generate-from-pdf", response_model=ReadingAIGenerateRead)
async def api_generate_material_from_pdf(
    org_id: int,
    pdf: UploadFile = File(...),
    title: str = Form(default=""),
    program_name: str = Form(default="Lectura 12-14 anos"),
    age_min: int = Form(default=12),
    age_max: int = Form(default=14),
    prompt: str = Form(default=""),
    target_words: int = Form(default=500),
    question_count: int = Form(default=6),
    db_session: Session = Depends(get_db_session),
    current_user: PublicUser = Depends(get_current_user),
):
    content = await pdf.read()
    reader = PdfReader(BytesIO(content))
    extracted_text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
    generate_request = ReadingAIGenerateRequest(
        title=title or pdf.filename or "",
        program_name=program_name,
        age_min=age_min,
        age_max=age_max,
        prompt=prompt,
        source_text=extracted_text,
        target_words=target_words,
        question_count=question_count,
    )
    return await generate_ai_material(org_id, generate_request, current_user, db_session)


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
