"""Core models that should make it into the top-level ``models`` namespace."""

import uuid
from datetime import datetime
from typing import Literal, Union

import sqlalchemy
from app import utcnow
from app.subscriptions import (
    PLAN_IDS,
    PLAN_NAMES,
    get_private_projects_limit,
    get_storage_limit,
)
from pydantic import BaseModel, EmailStr, computed_field
from sqlmodel import Field, Relationship, SQLModel


class Account(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(min_length=2, max_length=64, unique=True)
    created: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs=dict(
            server_default=sqlalchemy.func.current_timestamp()
        ),
    )
    user_id: uuid.UUID = Field(foreign_key="user.id", nullable=True)
    org_id: uuid.UUID = Field(foreign_key="org.id", nullable=True)
    github_name: str
    # Relationships
    owned_projects: list["Project"] = Relationship(
        back_populates="owner_account",
        cascade_delete=True,
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
    account_name: str | None = Field(default=None, max_length=64)
    github_username: str = Field(default=None, max_length=64)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=40)
    account_name: str | None = Field(default=None, max_length=64)
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
    updated: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs=dict(
            server_onupdate=sqlalchemy.func.now(),
            server_default=sqlalchemy.func.now(),
        ),
    )
    access_token: str  # These should be encrypted
    refresh_token: str
    expires: datetime | None
    refresh_token_expires: datetime | None


class UserZenodoToken(SQLModel, table=True):
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    updated: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs=dict(
            server_onupdate=sqlalchemy.func.now(),
            server_default=sqlalchemy.func.now(),
        ),
    )
    access_token: str  # These should be encrypted
    refresh_token: str
    expires: datetime | None
    refresh_token_expires: datetime | None


class UserOverleafToken(SQLModel, table=True):
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    updated: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs=dict(
            server_onupdate=sqlalchemy.func.now(),
            server_default=sqlalchemy.func.now(),
        ),
    )
    access_token: str  # These should be encrypted
    expires: datetime | None = Field(default=None)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    stripe_customer_id: str | None = None
    zenodo_user_id: str | None = None
    # Relationships
    account: Account = Relationship(back_populates="user", cascade_delete=True)
    github_token: UserGitHubToken | None = Relationship(cascade_delete=True)
    zenodo_token: UserZenodoToken | None = Relationship(cascade_delete=True)
    overleaf_token: UserOverleafToken | None = Relationship(
        cascade_delete=True
    )
    org_memberships: list["UserOrgMembership"] = Relationship(
        back_populates="user",
        cascade_delete=True,
    )
    subscription: Union["UserSubscription", None] = Relationship(
        back_populates="user", cascade_delete=True
    )
    project_access: list["UserProjectAccess"] = Relationship(
        back_populates="user",
        cascade_delete=True,
    )

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
    subscription: Union["UserSubscription", None]


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
    def github_name(self) -> str:
        return self.account.github_name

    @property
    def owned_projects(self) -> list["Project"]:
        return self.account.owned_projects

    @property
    def subscription_valid(self) -> bool:
        """Check if the org has a valid subscription."""
        if self.subscription is None:
            return False
        if self.subscription.paid_until is None:
            return True
        return self.subscription.paid_until >= utcnow()


# These could be put in the database, but that seems unnecessary
ROLE_IDS = {
    name: n for n, name in enumerate(["read", "write", "admin", "owner"])
}
ROLE_NAMES = {i: name for name, i in ROLE_IDS.items()}


# Track user membership in an org
class UserOrgMembership(SQLModel, table=True):
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    org_id: uuid.UUID = Field(foreign_key="org.id", primary_key=True)
    role_id: int = Field(ge=min(ROLE_IDS.values()), le=max(ROLE_IDS.values()))
    # Relationships
    user: User = Relationship(back_populates="org_memberships")
    org: Org = Relationship(back_populates="user_memberships")

    @computed_field
    @property
    def role_name(self) -> str:
        return ROLE_NAMES[self.role_id]


class _SubscriptionBase(SQLModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    created: datetime = Field(default_factory=utcnow)
    period_months: int
    price: float
    paid_until: datetime | None = None
    plan_id: int = Field(
        ge=min(PLAN_IDS.values()),
        le=max(PLAN_IDS.values()),
    )
    is_active: bool = True
    processor: str | None = None
    processor_product_id: str | None = None
    processor_price_id: str | None = None
    processor_subscription_id: str | None = None

    @computed_field
    @property
    def plan_name(self) -> str:
        return PLAN_NAMES[self.plan_id]

    @property
    def storage_limit(self) -> int:
        """Return the storage limit in GB."""
        return get_storage_limit(self.plan_name)  # type: ignore

    @property
    def private_projects_limit(self) -> int | None:
        """Return the max number of private projects for a subscription."""
        return get_private_projects_limit(self.plan_name)  # type: ignore


class OrgSubscription(_SubscriptionBase, table=True):
    org_id: uuid.UUID = Field(foreign_key="org.id", primary_key=True)
    n_users: int = Field(ge=1)
    subscriber_user_id: uuid.UUID = Field(foreign_key="user.id")
    # Relationships
    org: Org = Relationship(back_populates="subscription")


class UserSubscription(_SubscriptionBase, table=True):
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    # Relationships
    user: User = Relationship(back_populates="subscription")


class SubscriptionUpdate(BaseModel):
    plan_name: Literal["free", "standard", "professional"]
    period: Literal["monthly", "annual"]
    discount_code: str | None = None


class UpdateSubscriptionResponse(BaseModel):
    subscription: UserSubscription | OrgSubscription
    stripe_session_client_secret: str | None


class DiscountCode(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created: datetime = Field(default_factory=utcnow)
    created_by_user_id: uuid.UUID = Field(foreign_key="user.id")
    created_for_account_id: uuid.UUID | None = Field(
        foreign_key="account.id",
        nullable=True,
        default=None,
    )
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    plan_id: int = Field(
        ge=min(PLAN_IDS.values()),
        le=max(PLAN_IDS.values()),
    )
    price: float
    months: int
    n_users: int = 1
    redeemed: datetime | None = None
    redeemed_by_user_id: uuid.UUID | None = Field(
        foreign_key="user.id",
        nullable=True,
        default=None,
    )

    @property
    def plan_name(self) -> str:
        return PLAN_NAMES[self.plan_id]


class DiscountCodePost(BaseModel):
    valid_from: datetime | None = None
    valid_until: datetime | None = None
    created_for_account_name: str | None = None
    n_users: int = 1
    plan_name: Literal["standard", "professional"]
    price: float
    months: int


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


class UserTokenPublic(SQLModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id")
    scope: str | None = None
    created: datetime = Field(default_factory=utcnow)
    updated: datetime = Field(default_factory=utcnow)
    expires: datetime
    is_active: bool
    description: str | None = Field(default=None, max_length=256)
    last_used: datetime | None = Field(default=None)


class UserToken(UserTokenPublic, table=True):
    selector: str | None = Field(
        default=None, index=True, unique=True, max_length=32
    )
    hashed_verifier: str | None = Field(default=None, max_length=64)
    # Relationships
    user: User = Relationship()

    @property
    def expired(self) -> bool:
        """Check if the token has expired."""
        if self.expires is None:
            return False
        return self.expires < utcnow()


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
    status: str | None = Field(default=None, min_length=4, max_length=32)
    status_updated: datetime | None = Field(default_factory=utcnow)
    status_message: str | None = Field(default=None, max_length=2048)


class Project(ProjectBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_account_id: uuid.UUID = Field(foreign_key="account.id")
    parent_project_id: uuid.UUID | None = Field(
        foreign_key="project.id", default=None
    )
    # Relationships
    owner_account: Account = Relationship(back_populates="owned_projects")
    user_access_records: list["UserProjectAccess"] = Relationship(
        back_populates="project", cascade_delete=True
    )
    # TODO: Figure out how to do self-referential relationships with parent
    # and children projects
    questions: list["Question"] = Relationship(
        back_populates="project", cascade_delete=True
    )
    datasets: list["Dataset"] = Relationship(
        back_populates="project", cascade_delete=True
    )
    file_locks: list["FileLock"] = Relationship(
        back_populates="project", cascade_delete=True
    )

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
    def owner(self) -> User | Org | None:
        if self.owner_account_type == "user":
            return self.owner_account.user
        elif self.owner_account_type == "org":
            return self.owner_account.org

    @property
    def current_user_access(
        self,
    ) -> Literal["read", "write", "admin", "owner"] | None:
        return getattr(self, "_current_user_access", None)

    @current_user_access.setter
    def current_user_access(
        self, val: Literal["read", "write", "admin", "owner"]
    ):
        self._current_user_access = val

    @property
    def github_repo(self) -> str | None:
        if not self.git_repo_url.startswith("https://github.com"):
            return
        return self.git_repo_url.removeprefix(
            "https://github.com/"
        ).removesuffix(".git")


class ProjectPublic(ProjectBase):
    id: uuid.UUID
    owner_account_id: uuid.UUID
    owner_account_name: str
    owner_account_type: str
    current_user_access: Literal["read", "write", "admin", "owner"] | None = (
        None
    )


class ProjectsPublic(SQLModel):
    data: list[ProjectPublic]
    count: int


class ProjectCreate(ProjectBase):
    name: str = Field(min_length=4, max_length=255)
    title: str = Field(min_length=4, max_length=255)
    description: str | None = Field(
        default=None, min_length=0, max_length=2048
    )
    is_public: bool = Field(default=False)
    git_repo_url: str | None = Field(max_length=2048, default=None)
    template: str | None = None


class UserProjectAccess(SQLModel, table=True):
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id", primary_key=True)
    access: str | None = Field(max_length=32)
    created: datetime = Field(default_factory=utcnow)
    updated: datetime = Field(
        default_factory=utcnow,
        sa_column_kwargs=dict(
            server_onupdate=sqlalchemy.func.now(),
            server_default=sqlalchemy.func.now(),
        ),
    )
    # Relationships
    user: User = Relationship()
    project: Project = Relationship(back_populates="user_access_records")


class PipelineStage(SQLModel):
    cmd: str
    deps: list[str] | None = None
    outs: list[str | dict[str, dict]] | None = None
    desc: str | None = None
    meta: dict | None = None
    wdir: str | None = None


class ForeachStage(SQLModel):
    foreach: list[str] | str
    do: PipelineStage


class Pipeline(SQLModel):
    mermaid: str
    stages: dict[str, PipelineStage | ForeachStage]
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
    description: str | None = None
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


class DatasetBase(SQLModel):
    path: str = Field(primary_key=True)
    # Full path to origin project and dataset, if this is imported
    imported_from: str | None = None
    title: str | None = None
    tabular: bool | None = None
    stage: str | None = None
    description: str | None = None
    url: str | None = None  # To allow for downloads?


class Dataset(DatasetBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    # Project in which is was created
    project_id: uuid.UUID = Field(foreign_key="project.id", primary_key=True)
    # TODO: Track version somehow, and link to DVC remote MD5?
    # TODO: Is this a directory of files?
    # TODO: Track size? -- basically all DVC properties
    # Relationships
    project: Project = Relationship(back_populates="datasets")


class DVCOut(BaseModel):
    md5: str
    size: int
    hash: str = "md5"
    path: str
    remote: str
    push: bool = False


class DVCImport(BaseModel):
    """The necessary information to import a DVC object, which can be saved to
    a .dvc file.

    For example:

        outs:
          - md5: 46ce259ab949ecb23751eb88ec753ff2
            size: 83344240
            hash: md5
            path: time-ave-profiles.h5
            remote: calkit:petebachant/boundary-layer-turbulence-modeling
            push: false

    Note this is different from the file that would be produced by
    ``dvc import``, since they bundle in Git repo information to fetch from
    the original project's remote.

    """

    outs: list[DVCOut]


class GitImport(BaseModel):
    files: list[str]


class DatasetForImport(DatasetBase):
    dvc_import: DVCImport | None = None
    git_import: GitImport | None = None
    git_rev: str


class ImportedDataset(SQLModel):
    """A dataset imported into a project in a read-only fashion."""

    project_id: uuid.UUID = Field(foreign_key="project.id", primary_key=True)
    dataset_id: uuid.UUID = Field(foreign_key="dataset.id", primary_key=True)


class FileLock(SQLModel, table=True):
    project_id: uuid.UUID = Field(foreign_key="project.id", primary_key=True)
    path: str = Field(primary_key=True)
    created: datetime = Field(default_factory=utcnow)
    user_id: uuid.UUID = Field(foreign_key="user.id")
    # Relationships
    project: Project = Relationship(back_populates="file_locks")
    user: User = Relationship()

    @computed_field
    @property
    def user_github_username(self) -> str:
        return self.user.github_username

    @computed_field
    @property
    def user_email(self) -> str:
        return self.user.email


class StorageUsage(BaseModel):
    limit_gb: float
    used_gb: float


class ItemLock(BaseModel):
    created: datetime
    user_id: uuid.UUID
    user_email: str
    user_github_username: str


class _ContentsItemBase(BaseModel):
    name: str
    path: str
    type: str | None
    size: int | None
    in_repo: bool
    content: str | None = None
    url: str | None = None
    calkit_object: dict | None = None
    lock: ItemLock | None = None


class ContentsItem(_ContentsItemBase):
    dir_items: list[_ContentsItemBase] | None = None


class Publication(BaseModel):
    path: str
    title: str
    description: str | None = None
    type: (
        Literal[
            "journal-article",
            "conference-paper",
            "presentation",
            "poster",
            "report",
            "book",
        ]
        | None
    ) = None
    stage: str | None = None
    content: str | None = None
    stage_info: PipelineStage | None = None
    url: str | None = None


class Notebook(BaseModel):
    path: str
    title: str
    description: str | None = None
    stage: str | None = None
    output_format: Literal["html", "notebook"] | None = None
    url: str | None = None
    content: str | None = None
