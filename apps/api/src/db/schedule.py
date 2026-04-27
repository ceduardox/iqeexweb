from enum import Enum
from typing import Optional
from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel

from src.db.users import UserRead


class ScheduleSessionStatus(str, Enum):
    SCHEDULED = "scheduled"
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    NO_SHOW = "no_show"


class ScheduleNotificationType(str, Enum):
    SESSION_BOOKED = "session_booked"
    SESSION_CANCELLED = "session_cancelled"


class TutorAssignmentBase(SQLModel):
    org_id: int = Field(sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True))
    tutor_user_id: int = Field(sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True))
    student_user_id: int = Field(sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True))
    course_id: Optional[int] = Field(default=None, foreign_key="course.id")
    active: bool = True


class TutorAssignment(TutorAssignmentBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    assignment_uuid: str = Field(default="", index=True)
    created_by_id: int = Field(default=0, foreign_key="user.id")
    creation_date: str = ""
    update_date: str = ""


class TutorAssignmentCreate(SQLModel):
    tutor_user_id: int
    student_user_id: int
    course_id: Optional[int] = None
    active: bool = True


class TutorAssignmentRead(TutorAssignmentBase):
    id: int
    assignment_uuid: str
    tutor: UserRead
    student: UserRead
    created_by_id: int
    creation_date: str
    update_date: str


class TutorAvailabilityBase(SQLModel):
    org_id: int = Field(sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True))
    tutor_user_id: int = Field(sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True))
    weekday: int = Field(ge=0, le=6)
    start_time: str
    end_time: str
    slot_minutes: int = 30
    timezone: str = "UTC"
    active: bool = True


class TutorAvailability(TutorAvailabilityBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    availability_uuid: str = Field(default="", index=True)
    creation_date: str = ""
    update_date: str = ""


class TutorAvailabilityCreate(SQLModel):
    tutor_user_id: int
    weekday: int
    start_time: str
    end_time: str
    slot_minutes: int = 30
    timezone: str = "UTC"
    active: bool = True


class TutorAvailabilityRead(TutorAvailabilityBase):
    id: int
    availability_uuid: str
    creation_date: str
    update_date: str


class ScheduleSessionBase(SQLModel):
    org_id: int = Field(sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True))
    tutor_user_id: int = Field(sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True))
    student_user_id: int = Field(sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True))
    course_id: Optional[int] = Field(default=None, foreign_key="course.id")
    starts_at: str = Field(index=True)
    ends_at: str = Field(index=True)
    timezone: str = "UTC"
    student_notes: Optional[str] = ""
    status: ScheduleSessionStatus = ScheduleSessionStatus.SCHEDULED


class ScheduleSession(ScheduleSessionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_uuid: str = Field(default="", index=True)
    created_by_id: int = Field(default=0, foreign_key="user.id")
    cancellation_reason: Optional[str] = ""
    creation_date: str = ""
    update_date: str = ""


class ScheduleSessionCreate(SQLModel):
    tutor_user_id: int
    starts_at: str
    ends_at: str
    timezone: str = "UTC"
    student_notes: Optional[str] = ""
    course_id: Optional[int] = None


class ScheduleSessionRead(ScheduleSessionBase):
    id: int
    session_uuid: str
    tutor: UserRead
    student: UserRead
    created_by_id: int
    cancellation_reason: Optional[str] = ""
    creation_date: str
    update_date: str


class ScheduleNotification(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    notification_uuid: str = Field(default="", index=True)
    org_id: int = Field(sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"), index=True))
    user_id: int = Field(sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), index=True))
    type: ScheduleNotificationType
    title: str
    body: str
    session_uuid: Optional[str] = Field(default="", index=True)
    read_at: Optional[str] = None
    creation_date: str = ""


class ScheduleNotificationRead(SQLModel):
    id: int
    notification_uuid: str
    org_id: int
    user_id: int
    type: ScheduleNotificationType
    title: str
    body: str
    session_uuid: Optional[str] = ""
    read_at: Optional[str] = None
    creation_date: str


class ScheduleSummary(SQLModel):
    is_admin: bool
    is_tutor: bool
    assigned_tutors: list[UserRead]
    upcoming_sessions: list[ScheduleSessionRead]
    notifications: list[ScheduleNotificationRead]


class ScheduleSlot(SQLModel):
    starts_at: str
    ends_at: str
    available: bool
