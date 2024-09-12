"""Functionality for working with subscriptions."""

from typing import Literal

SUBSCRIPTION_TYPE_IDS = {
    level: n
    for n, level in enumerate(
        ["free", "standard", "professional", "enterprise"]
    )
}
SUBSCRIPTION_TYPE_NAMES = {
    i: level for level, i in SUBSCRIPTION_TYPE_IDS.items()
}
PRICES_BY_SUBSCRIPTION_TYPE_NAME = {
    "free": 0.0,
    "standard": 10.0,
    "professional": 50.0,
}
ANNUAL_DISCOUNT_FACTOR = 0.9


def get_monthly_price(
    subscription_type_name: Literal["free", "standard", "professional"],
    period: Literal["monthly", "annual"],
) -> float:
    price = PRICES_BY_SUBSCRIPTION_TYPE_NAME[subscription_type_name]
    if period == "annual":
        price = price * ANNUAL_DISCOUNT_FACTOR
    return price
