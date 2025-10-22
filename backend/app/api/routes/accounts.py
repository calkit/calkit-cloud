"""API endpoints for accounts."""

import logging
from typing import Literal

from fastapi import APIRouter, HTTPException
from sqlmodel import SQLModel, select

from app.api.deps import CurrentUserOptional, SessionDep
from app.models import Account

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


class AccountPublic(SQLModel):
    name: str
    github_name: str
    kind: Literal["user", "org"]


@router.get("/accounts/{account_name}")
def get_account(
    account_name: str,
    session: SessionDep,
    current_user: CurrentUserOptional,
) -> AccountPublic:
    account_query = select(Account).where(Account.name == account_name)
    account = session.exec(account_query).first()
    if account is None:
        raise HTTPException(
            404, f"Account '{account_name}' not found or inaccessible."
        )
    account = dict(account)
    account["kind"] = "org" if account.get("org_id") is not None else "user"
    return AccountPublic.model_validate(account)
