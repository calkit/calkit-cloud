"""Database/request models."""

import uuid
from datetime import datetime
from typing import Literal, Union

from app import utcnow
from pydantic import EmailStr, computed_field
from sqlmodel import Field, Relationship, SQLModel


class Account(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(min_length=2, max_length=64, unique=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", nullable=True)
    org_id: uuid.UUID = Field(foreign_key="org.id", nullable=True)
    github_name: str
    # Relationships
    owned_projects: list["Project"] = Relationship(
        back_populates="owner_account"
    )
    user: Union["User", None] = Relationship(back_populates="account")
    org: Union["Org", None] = Relationship(back_populates="account")

    @computed_field
    @property
    def type(self) -> str:
        if self.user_id is not None:
            return "user"
        elif self.org_id is not None:
            return "org"
        else:
            raise ValueError("Account is neither a user nor org account")


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=40)
    github_username: str = Field(default=None, max_length=64)


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
    account: Account = Relationship(back_populates="user")
    github_token: UserGitHubToken | None = Relationship()
    org_memberships: list["UserOrgMembership"] = Relationship(
        back_populates="user"
    )
    subscription: "UserSubscription" = Relationship(back_populates="user")

    @computed_field
    @property
    def github_username(self) -> str:
        return self.account.github_name

    @property
    def owned_projects(self) -> list["Project"]:
        return self.account.owned_projects


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    github_username: str


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


class Org(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    display_name: str = Field(min_length=2, max_length=255)
    # Relationships
    account: Account = Relationship(back_populates="org")
    user_memberships: list["UserOrgMembership"] = Relationship(
        back_populates="org"
    )
    subscription: "OrgSubscription" = Relationship(back_populates="org")

    @computed_field
    @property
    def owned_projects(self) -> list["Project"]:
        return self.account.owned_projects


# Track user membership in an org
class UserOrgMembership(SQLModel):
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="org.id", primary_key=True)
    role: Literal["read", "write", "admin", "owner"]
    # Relationships
    user: User = Relationship(back_populates="org_memberships")
    org: Org = Relationship(back_populates="user_memberships")


SubscriptionLevel = Literal["standard", "pro", "enterprise"]


class _SubscriptionBase(SQLModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    created: datetime = Field(default_factory=utcnow)
    period: Literal["month", "year"]
    price: float
    paid_until: datetime | None = None
    level: SubscriptionLevel
    is_active: bool = True
    processor: str | None = None
    processor_plan_id: str | None = None
    processor_subscription_id: str | None = None


class OrgSubscription(_SubscriptionBase, table=True):
    org_id: uuid.UUID = Field(foreign_key="org.id", primary_key=True)
    n_users: int = Field(ge=1)
    # Relationships
    org: Org = Relationship(back_populates="subscription")


class UserSubscription(_SubscriptionBase, table=True):
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    # Relationships
    user: User = Relationship(back_populates="subscription")


class DiscountCode(SQLModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created: datetime = Field(default_factory=utcnow)
    created_by_user_id: uuid.UUID = Field(foreign_key="user.id")
    created_for_account_id: uuid.UUID = Field(foreign_key="account.id")
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    subscription_level: SubscriptionLevel
    price: float
    months: int
    n_users: int = 1
    redeemed: datetime | None = None
    redeemed_by_user_id: uuid.UUID = Field(foreign_key="user.id")


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
    title: str = Field(min_length=4, max_length=255)
    description: str | None = Field(
        default=None, min_length=0, max_length=2048
    )
    is_public: bool = Field(default=False)
    created: datetime | None = Field(default_factory=utcnow)
    updated: datetime | None = Field(default_factory=utcnow)
    git_repo_url: str = Field(max_length=2048)
    latest_git_rev: str | None = Field(
        max_length=40, nullable=True, default=None
    )


class Project(ProjectBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_account_id: uuid.UUID = Field(foreign_key="account.id")
    # Relationships
    owner_account: Account = Relationship(back_populates="owned_projects")
    questions: list["Question"] = Relationship(back_populates="project")

    @computed_field
    @property
    def owner_account_name(self) -> str:
        return self.owner_account.name

    @computed_field
    @property
    def owner_account_type(self) -> str:
        return self.owner_account.type

    @computed_field
    @property
    def owner_github_name(self) -> str:
        return self.owner_account.github_name

    @property
    def owner(self) -> User | Org:
        if self.owner_account_type == "user":
            return self.owner_account.user
        elif self.owner_account_type == "org":
            return self.owner_account.org


class ProjectPublic(ProjectBase):
    id: uuid.UUID
    owner_account_id: uuid.UUID
    owner_account_name: str
    owner_account_type: str


class ProjectsPublic(SQLModel):
    data: list[ProjectPublic]
    count: int


class ProjectCreate(ProjectBase):
    pass


class WorkflowStage(SQLModel):
    cmd: str
    deps: list[str] | None = None
    outs: list[str | dict[str, dict]] | None = None
    desc: str | None = None
    meta: dict | None = None
    wdir: str | None = None


class Workflow(SQLModel):
    mermaid: str
    stages: dict[str, WorkflowStage]
    yaml: str


class Question(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id")
    number: int
    question: str
    # Relationships
    project: Project = Relationship(back_populates="questions")


class Figure(SQLModel):
    path: str
    title: str
    description: str
    stage: str | None = None
    dataset: str | None = None
    content: str | None = None  # Base64 encoded
    url: str | None = None
    # TODO: Link to a dataset, or does the pipeline do that?
    # TODO: Add content, or maybe we can just get from Git contents via path?


class FigureComment(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id")
    figure_path: str = Field(max_length=255)
    user_id: uuid.UUID = Field(foreign_key="user.id")
    created: datetime = Field(default_factory=utcnow)
    updated: datetime = Field(default_factory=utcnow)
    external_url: str | None = Field(default=None, max_length=2048)
    comment: str
    # Relationships
    user: User = Relationship()

    @computed_field
    @property
    def user_github_username(self) -> str:
        return self.user.github_username

    @computed_field
    @property
    def user_full_name(self) -> str:
        return self.user.full_name

    @computed_field
    @property
    def user_email(self) -> str:
        return self.user.email


class FigureCommentPost(SQLModel):
    figure_path: str
    comment: str


class Dataset(SQLModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    # Project in which is was created
    project_id: uuid.UUID = Field(foreign_key="project.id")
    # Full path to origin project and dataset, if this is imported
    imported_from: str | None = None
    path: str
    title: str | None = None
    tabular: bool | None = None
    stage: str | None = None
    description: str | None = None
    url: str | None = None  # To allow for downloads?
    # TODO: Track version somehow, and link to DVC remote MD5?
    # TODO: Is this a directory of files?
    # TODO: Track size? -- basically all DVC properties


class ImportedDataset(SQLModel):
    """A dataset imported into a project in a read-only fashion."""

    project_id: uuid.UUID = Field(foreign_key="project.id", primary_key=True)
    dataset_id: uuid.UUID = Field(foreign_key="dataset.id", primary_key=True)
