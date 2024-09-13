"""Miscellaneous routes."""

import uuid
import os
import json
import stripe

from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.core import utcnow
from app.messaging import generate_test_email, send_email
from app.models import (
    PLAN_IDS,
    Account,
    DiscountCode,
    DiscountCodePost,
    Message,
    User,
)
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pydantic.networks import EmailStr
from sqlalchemy.exc import DataError
from sqlmodel import select
from starlette.requests import Request

router = APIRouter()


@router.post(
    "/test-email/",
    dependencies=[Depends(get_current_active_superuser)],
    status_code=201,
)
def test_email(email_to: EmailStr) -> Message:
    """Test emails."""
    email_data = generate_test_email(email_to=email_to)
    send_email(
        email_to=email_to,
        subject=email_data.subject,
        html_content=email_data.html_content,
    )
    return Message(message="Test email sent")


class DiscountCodePublic(BaseModel):
    id: uuid.UUID
    is_valid: bool = True
    reason: str | None = None
    n_users: int | None = None
    price: float | None = None
    months: int | None = None
    plan_name: str | None = None


@router.get("/discount-codes/{discount_code}")
def get_discount_code(
    discount_code: str,
    session: SessionDep,
    current_user: CurrentUser,
    n_users: int = 1,
) -> DiscountCodePublic:
    try:
        code = session.get(DiscountCode, discount_code)
    except DataError:
        raise HTTPException(422, "Code is invalid")
    if code is None:
        raise HTTPException(404, "Code does not exist")
    # Check if this code has been redeemed
    if code.redeemed is not None:
        return DiscountCodePublic(
            id=code.id, is_valid=False, reason="Code has been redeemed"
        )
    # Check if this code is no longer valid
    now = utcnow()
    if code.valid_from is not None and now < code.valid_from:
        return DiscountCodePublic(
            id=code.id, is_valid=False, reason="Code is not yet active"
        )
    if code.valid_until is not None and now > code.valid_until:
        return DiscountCodePublic(
            id=code.id, is_valid=False, reason="Code is not yet active"
        )
    # Check if this code was created for a particular user
    if code.created_for_account_id is not None:
        if current_user.account.id != code.created_for_account_id:
            return DiscountCodePublic(
                id=code.id,
                is_valid=False,
                reason="Code was not created for this account",
            )
    if code.n_users != n_users:
        return DiscountCodePublic(
            id=code.id,
            is_valid=False,
            reason=f"Number of users does not match ({code.n_users})",
        )
    return DiscountCodePublic.model_validate(
        code.model_dump() | {"plan_name": code.plan_name}
    )


@router.post("/discount-codes")
def post_discount_code(
    session: SessionDep,
    req: DiscountCodePost,
    current_user: User = Depends(get_current_active_superuser),
) -> DiscountCode:
    created_for_account_id = None
    if req.created_for_account_name is not None:
        account = session.exec(
            select(Account).where(Account.name == req.created_for_account_name)
        ).first()
        if account is None:
            raise HTTPException(400, "Account does not exist")
        created_for_account_id = account.id
    code = DiscountCode.model_validate(
        req,
        update=dict(
            created_by_user_id=current_user.id,
            created_for_account_id=created_for_account_id,
            plan_id=PLAN_IDS[req.plan_name],
        ),
    )
    session.add(code)
    session.commit()
    session.refresh(code)
    return code


@router.post("/stripe-events", include_in_schema=False)
async def post_stripe_event(request: Request):
    # This comes directly from the Stripe example server app
    # You can use webhooks to receive information about asynchronous payment
    # events
    # For more about our webhook events check out
    # https://stripe.com/docs/webhooks
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    request_data = await request.json()
    if webhook_secret:
        # Retrieve the event by verifying the signature using the raw body and
        # secret if webhook signing is configured
        signature = request.headers.get("stripe-signature")
        try:
            event = stripe.Webhook.construct_event(
                payload=request.data,
                sig_header=signature,
                secret=webhook_secret,
            )
            data = event["data"]
        except Exception as e:
            return e
        event_type = event["type"]
    else:
        data = request_data["data"]
        event_type = request_data["type"]
    data_object = data["object"]
    if event_type == "invoice.payment_succeeded":
        if data_object["billing_reason"] == "subscription_create":
            # The subscription automatically activates after successful payment
            # Set the payment method used to pay the first invoice
            # as the default payment method for that subscription
            subscription_id = data_object["subscription"]
            payment_intent_id = data_object["payment_intent"]

            # Retrieve the payment intent used to pay the subscription
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)

            # Set the default payment method
            stripe.Subscription.modify(
                subscription_id,
                default_payment_method=payment_intent.payment_method,
            )

            print(
                "Default payment method set for subscription:"
                + payment_intent.payment_method
            )
    elif event_type == "invoice.payment_failed":
        # If the payment fails or the customer does not have a valid payment
        # method,
        # an invoice.payment_failed event is sent, the subscription becomes
        # past_due
        # Use this webhook to notify your user that their payment has
        # failed and to retrieve new card details.
        # print(data)
        print("Invoice payment failed: %s", event.id)
    elif event_type == "invoice.finalized":
        # If you want to manually send out invoices to your customers
        # or store them locally to reference to avoid hitting Stripe rate
        # limits
        # print(data)
        print("Invoice finalized: %s", event.id)
    elif event_type == "customer.subscription.deleted":
        # handle subscription cancelled automatically based
        # upon your subscription settings. Or if the user cancels it.
        # print(data)
        print("Subscription canceled: %s", event.id)
