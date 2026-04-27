from typing import Optional

from sqlalchemy import JSON, Column, String
from sqlmodel import Field, SQLModel


class PlatformSetting(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(sa_column=Column(String, unique=True, index=True, nullable=False))
    value: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    creation_date: Optional[str] = None
    update_date: Optional[str] = None
