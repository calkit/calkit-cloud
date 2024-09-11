"""Routes for orgs."""

import logging
import uuid

import requests
from app.api.deps import CurrentUser, SessionDep
from app.models import Org, Account, UserOrgMembership, ROLE_IDS
from app.users import get_github_token
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import select

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


class OrgPublic(BaseModel):
    id: uuid.UUID
    display_name: str
    github_name: str
    role: str


@router.get("/user/orgs")
def get_user_orgs(
    session: SessionDep,
    current_user: CurrentUser,
) -> list[OrgPublic]:
    resp = []
    for membership in current_user.org_memberships:
        org = membership.org
        resp.append(
            OrgPublic(
                id=org.id,
                display_name=org.display_name,
                github_name=org.github_name,
                role=membership.role_name,
            )
        )
    return resp


class OrgPost(BaseModel):
    github_name: str


@router.post("/orgs")
def post_org(
    req: OrgPost, session: SessionDep, current_user: CurrentUser
) -> OrgPublic:
    org_name = req.github_name
    query = select(Org).where(Org.account.has(github_name=org_name))
    if session.exec(query).first() is not None:
        raise HTTPException(400, "This org already exists")
    token = get_github_token(session=session, user=current_user)
    headers = {"Authorization": f"Bearer {token}"}
    org_resp = requests.get(
        f"https://api.github.com/orgs/{org_name}",
        headers=headers,
    )
    if org_resp.status_code != 200:
        logger.info(
            f"Could not find org {org_name} on GitHub ({org_resp.status_code})"
        )
        raise HTTPException(400, "Could not fetch org from GitHub")
    # Org doesn't exist, so we can create it an give this user
    # ownership, but only if they have ownership on GitHub
    membership_resp = requests.get(
        (
            f"https://api.github.com/orgs/{org_name}/"
            f"memberships/{current_user.github_username}"
        ),
        headers=headers,
    )
    if membership_resp.status_code != 200:
        logger.info(
            (
                f"User {current_user.github_username} is not a "
                f"member of org {org_name} on GitHub"
            )
        )
        raise HTTPException(
            membership_resp.status_code,
            "Could not verify org membership on GitHub",
        )
    role = membership_resp.json()["role"]
    if role != "admin":
        raise HTTPException(400, "Must be admin of GitHub org to create")
    # If the role is admin, we can make this user an owner here
    org = Org(
        display_name=org_resp.json()["name"],
        account=Account(name=org_name, github_name=org_name),
        user_memberships=[
            UserOrgMembership(user=current_user, role_id=ROLE_IDS["owner"])
        ],
    )
    session.add(org)
    session.commit()
    session.refresh(org)
    return OrgPublic(
        id=org.id,
        display_name=org.display_name,
        github_name=org.github_name,
        role="owner",
    )
