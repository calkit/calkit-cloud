"""Database/request models."""

import uuid
from datetime import datetime

from app import utcnow
from pydantic import EmailStr, computed_field
from slugify import slugify
from sqlmodel import Field, Relationship, SQLModel


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)
    github_username: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=40)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=40)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=40)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)
    github_username: str | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=40)
    new_password: str = Field(min_length=8, max_length=40)


class UserGitHubToken(SQLModel, table=True):
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    updated: datetime = Field(default_factory=utcnow)
    access_token: str  # These should be encrypted
    refresh_token: str
    expires: datetime | None
    refresh_token_expires: datetime | None


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    # Relationships
    items: list["Item"] = Relationship(
        back_populates="owner", cascade_delete=True
    )
    owned_projects: list["Project"] = Relationship(back_populates="owner")
    github_token: UserGitHubToken | None = Relationship()


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    title: str = Field(min_length=1, max_length=255)


# Properties to receive on item update
class ItemUpdate(ItemBase):
    title: str | None = Field(default=None, min_length=1, max_length=255)  # type: ignore


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    title: str = Field(max_length=255)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=40)


class ProjectBase(SQLModel):
    name: str = Field(min_length=4, max_length=255)
    description: str | None = Field(
        default=None, min_length=0, max_length=2048
    )
    git_repo_url: str = Field(max_length=2048)
    is_public: bool = Field(default=False)


class Project(ProjectBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_user_id: uuid.UUID = Field(foreign_key="user.id")
    # Relationships
    owner: User | None = Relationship(back_populates="owned_projects")

    @computed_field
    @property
    def owner_github_username(self) -> str:
        return self.owner.github_username


class ProjectPublic(ProjectBase):
    id: uuid.UUID
    owner_user_id: uuid.UUID
    owner_github_username: str | None

    @computed_field
    @property
    def name_slug(self) -> str:
        return slugify(self.name)


class ProjectsPublic(SQLModel):
    data: list[ProjectPublic]
    count: int


class ProjectCreate(ProjectBase):
    pass


class Question(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id")
    question: str


class Figure(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id")
    path: str
    title: str
    description: str | None
    pipeline: str | None
    # TODO: Link to a dataset, or does the pipeline do that?
    # TODO: Add content, or maybe we can just get from Git contents via path?


class FigureComment(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # What figure are we commenting on?
    # Should we just track this by the project and local repo path of the
    # figure, since that's how it's identified in the figures file?
    figure_id: uuid.UUID = Field(foreign_key="figure.id")
    user_id: uuid.UUID = Field(foreign_key="user.id")
    created: datetime = Field(default_factory=utcnow)
    comment: str


class Dataset(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # Project in which is was created
    project_id: uuid.UUID = Field(foreign_key="project.id")
    path: str
    tabular: bool
    pipeline: str | None = None
    description: str
    # TODO: Track version somehow, and link to DVC remote MD5?
    # TODO: Is this a directory of files?
    # TODO: Track size? -- basically all DVC properties


class ImportedDataset(SQLModel, table=True):
    """A dataset imported into a project in a read-only fashion."""
    project_id: uuid.UUID = Field(foreign_key="project.id", primary_key=True)
    dataset_id: uuid.UUID = Field(foreign_key="dataset.id", primary_key=True)
