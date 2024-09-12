"""Miscellaneous routes."""

import uuid

from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.core import utcnow
from app.messaging import generate_test_email, send_email
from app.models import (
    Account,
    DiscountCode,
    DiscountCodePost,
    Message,
    User,
    SUBSCRIPTION_TYPE_IDS,
)
from app.orgs import get_org_from_db
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pydantic.networks import EmailStr
from sqlmodel import select

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


@router.get("/discount-codes/{discount_code}")
def get_discount_code(
    discount_code: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> DiscountCodePublic:
    code = session.get(DiscountCode, discount_code)
    if code is None:
        return HTTPException(404, "Code does not exist")
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
    return DiscountCodePublic.model_validate(code.model_dump())


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
            subscription_type_id=SUBSCRIPTION_TYPE_IDS[
                req.subscription_type
            ],
        ),
    )
    session.add(code)
    session.commit()
    session.refresh(code)
    return code
