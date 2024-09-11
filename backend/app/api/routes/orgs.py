"""Routes for orgs."""

import logging
import uuid
from typing import Literal

import requests
from app.api.deps import CurrentUser, SessionDep
from app.core import utcnow
from app.models import ROLE_IDS, Account, Message, Org, User, UserOrgMembership
from app.users import get_github_token
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

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


def _get_org_from_db(org_name: str, session: Session) -> Org | None:
    query = select(Org).where(Org.account.has(name=org_name))
    return session.exec(query).first()


class OrgPost(BaseModel):
    github_name: str


@router.post("/orgs")
def post_org(
    req: OrgPost, session: SessionDep, current_user: CurrentUser
) -> OrgPublic:
    org_name = req.github_name
    if _get_org_from_db(org_name=req.github_name, session=session) is not None:
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


class OrgMemberPost(BaseModel):
    username: str
    role: Literal["read", "write", "admin", "owner"]


@router.post("/orgs/{org_name}/members")
def add_org_member(
    org_name: str,
    req: OrgMemberPost,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    org = _get_org_from_db(org_name=org_name, session=session)
    if org is None:
        logger.info("Org '{org_name}' does not exist")
        raise HTTPException(404)
    # Ensure the current user is an org admin or owner
    role = None
    for membership in current_user.org_memberships:
        if membership.org.account.name == org_name:
            role = membership.role_name
    if role not in ["owner", "admin"]:
        logger.info("User is not an admin or owner of this org")
        raise HTTPException(403)
    # TODO: Check that this user is a member of the GitHub org?
    user_query = select(User).where(User.account.has(name=req.username))
    user = session.exec(user_query).first()
    if user is None:
        logger.info("Requested user does not exist")
        raise HTTPException(404, "User does not exist")
    if user in [m.user for m in org.user_memberships]:
        raise HTTPException(400, "User already exists in org")
    # Make sure this org has enough seats left
    subscription = org.subscription
    if subscription is None or subscription.paid_until < utcnow():
        logger.info(f"Org {org_name} has no valid subscription")
        raise HTTPException(400, "No valid subscription")
    n_users = subscription.n_users
    taken = len(org.user_memberships)
    left = n_users - taken
    if left <= 0:
        logger.info("No seats left")
        raise HTTPException(400, "No more seats left for this org")
    membership = UserOrgMembership(
        user=user, org=org, role_id=ROLE_IDS[req.role]
    )
    session.add(membership)
    session.commit()
    return Message(message="success")
