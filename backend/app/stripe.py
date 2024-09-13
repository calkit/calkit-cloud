"""Functionality for working with Stripe."""

import stripe
from app.config import settings
from pydantic import EmailStr

stripe.api_key = settings.STRIPE_SECRET_KEY


def get_products():
    return stripe.Product.list()


def get_prices():
    return stripe.Price.list()


def get_customers():
    return stripe.Customer.list()


def create_customer(email: EmailStr):
    return stripe.Customer.create(email=email)


def create_subscription(customer_id, price_id):
    return stripe.Subscription.create(
        customer=customer_id,
        items=[
            {
                "price": price_id,
            }
        ],
        payment_behavior="default_incomplete",
        expand=["latest_invoice.payment_intent"],
    )


def cancel_subscription(subscription_id):
    return stripe.Subscription.delete(subscription_id)


def get_customer_subscriptions(customer_id):
    return stripe.Subscription.list(
        customer=customer_id,
        status="all",
        expand=["data.default_payment_method"],
    )
