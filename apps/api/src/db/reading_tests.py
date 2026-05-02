from enum import Enum
from typing import Optional

from sqlalchemy import Column, ForeignKey, Integer, JSON
from sqlmodel import Field, SQLModel

from src.db.users import UserRead


class ReadingMaterialStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class ReadingMaterialBase(SQLModel):
    org_id: int = Field(sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True))
    title: str
    description: Optional[str] = ""
    program_name: str
    age_min: int = 0
    age_max: int = 99
    pdf_name: Optional[str] = ""
    text_content: str
    questions: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    status: ReadingMaterialStatus = ReadingMaterialStatus.PUBLISHED


class ReadingMaterial(ReadingMaterialBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    material_uuid: str = Field(default="", index=True)
    created_by_id: int = Field(default=0, foreign_key="user.id")
    creation_date: str = ""
    update_date: str = ""


class ReadingMaterialCreate(SQLModel):
    title: str
    description: Optional[str] = ""
    program_name: str
    age_min: int = 0
    age_max: int = 99
    pdf_name: Optional[str] = ""
    text_content: str
    questions: list[dict] = Field(default_factory=list)
    status: ReadingMaterialStatus = ReadingMaterialStatus.PUBLISHED


class ReadingMaterialRead(ReadingMaterialBase):
    id: int
    material_uuid: str
    creator: Optional[UserRead] = None
    created_by_id: int
    creation_date: str
    update_date: str


class ReadingAIGenerateRequest(SQLModel):
    title: Optional[str] = ""
    program_name: str
    age_min: int = 0
    age_max: int = 99
    prompt: Optional[str] = ""
    source_text: Optional[str] = ""
    target_words: int = 500
    question_count: int = 6


class ReadingAIGenerateRead(SQLModel):
    title: str
    description: Optional[str] = ""
    program_name: str
    age_min: int
    age_max: int
    text_content: str
    questions: list[dict] = Field(default_factory=list)
    estimated_reading_seconds: int = 0
    source: str = "ai"


class ReadingProgramAssignmentRead(SQLModel):
    id: int
    collection_uuid: str
    name: str
    public: bool
    usergroup_id: Optional[int] = None
    instructors: list[dict] = Field(default_factory=list)
    students: list[UserRead] = Field(default_factory=list)


class ReadingProgramUserAssign(SQLModel):
    collection_uuid: str
    user_id: int
    can_edit: bool = False


class ReadingAttemptBase(SQLModel):
    org_id: int = Field(sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True))
    material_id: int = Field(sa_column=Column(Integer, ForeignKey("readingmaterial.id", ondelete="CASCADE"), index=True))
    student_user_id: int = Field(sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True))
    duration_seconds: int
    words_count: int
    wpm: int
    comprehension: int
    retention: int
    level: str
    answers: list[dict] = Field(default_factory=list, sa_column=Column(JSON))


class ReadingAttempt(ReadingAttemptBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    attempt_uuid: str = Field(default="", index=True)
    creation_date: str = ""


class ReadingAttemptCreate(SQLModel):
    material_id: int
    duration_seconds: int
    words_count: int
    wpm: int
    comprehension: int
    retention: int
    level: str
    answers: list[dict] = Field(default_factory=list)


class ReadingAttemptRead(ReadingAttemptBase):
    id: int
    attempt_uuid: str
    material: Optional[ReadingMaterialRead] = None
    student: Optional[UserRead] = None
    creation_date: str
