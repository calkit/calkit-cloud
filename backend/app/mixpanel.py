"""Functionality for working with Mixpanel."""

from app.config import settings
from app.models import User
from mixpanel import Mixpanel

mp = Mixpanel(settings.MIXPANEL_TOKEN)


def track(
    user: User,
    event_name: str,
    add_event_info: dict | None = None,
    meta: dict | None = None,
):
    return mp.track(
        str(user.id),
        event_name=event_name,
        properties=add_event_info,
        meta=meta,
    )


def user_created_new_token(user: User, scope: str | None, expires_days: int):
    track(
        user,
        "Created new token",
        add_event_info=dict(scope=scope, expires_days=expires_days),
    )


def user_logged_in(user: User):
    track(user, "Logged in")


def user_signed_up(user: User):
    track(user, "Signed up")


def user_dvc_pushed(user: User, owner_name: str, project_name: str):
    track(
        user,
        "DVC push",
        add_event_info=dict(owner_name=owner_name, project_name=project_name),
    )


def user_dvc_pulled(user: User, owner_name: str, project_name: str):
    track(
        user,
        "DVC pull",
        add_event_info=dict(owner_name=owner_name, project_name=project_name),
    )


def user_out_of_storage(user: User):
    track(user, "Out of storage")
