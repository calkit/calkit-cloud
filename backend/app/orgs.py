"""Functionality for working with orgs."""

from app.models import Org
from sqlmodel import Session, select


def get_org_from_db(org_name: str, session: Session) -> Org | None:
    query = select(Org).where(Org.account.has(name=org_name))
    return session.exec(query).first()
