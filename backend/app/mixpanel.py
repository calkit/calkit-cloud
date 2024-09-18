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
        user.id, event_name=event_name, properties=add_event_info, meta=meta
    )


def created_new_token(user: User, scope: str, expires_days: int):
    track(
        user,
        "Created new token",
        add_event_info=dict(scope=scope, expires_days=expires_days),
    )
