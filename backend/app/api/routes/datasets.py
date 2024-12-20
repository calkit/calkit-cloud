"""API endpoints for datasets."""

import logging

import sqlalchemy
from app.api.deps import CurrentUser, SessionDep
from app.models import Dataset, Project, ProjectPublic
from fastapi import APIRouter
from sqlmodel import SQLModel, func, or_, select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


class DatasetResponse(SQLModel):
    project: ProjectPublic
    path: str
    title: str | None
    description: str | None
    imported_from: str | None


class DatasetsResponse(SQLModel):
    data: list[DatasetResponse]
    count: int


@router.get("/datasets")
def get_datasets(
    session: SessionDep,
    current_user: CurrentUser,
    limit: int = 100,
    offset: int = 0,
    include_imported: bool = False,
) -> DatasetsResponse:
    # TODO: Handle collaborator access for private project datasets
    count_query = (
        select(func.count())
        .select_from(Dataset)
        .join(Project)
        .where(
            or_(
                Project.is_public,
                Project.owner_account_id == current_user.account.id,
            )
        )
    )
    if not include_imported:
        count_query = count_query.filter(Dataset.imported_from.is_(None))
    count = session.exec(count_query).one()
    select_query = (
        select(Dataset)
        .join(Project)
        .where(
            or_(
                Project.is_public,
                Project.owner_account_id == current_user.account.id,
            )
        )
        .order_by(sqlalchemy.asc(Project.title))
        .limit(limit)
        .offset(offset)
    )
    if not include_imported:
        select_query = select_query.filter(Dataset.imported_from.is_(None))
    datasets = session.exec(select_query).all()
    return DatasetsResponse(data=datasets, count=count)
