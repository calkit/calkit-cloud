from datetime import timedelta
from unittest.mock import patch

import pytest
from app.config import settings
from app.core import utcnow
from app.models import DeviceAuth, User
from app.security import generate_password_reset_token, verify_password
from fastapi.testclient import TestClient
from sqlmodel import Session, select


def test_get_access_token(client: TestClient) -> None:
    login_data = {
        "username": settings.FIRST_SUPERUSER,
        "password": settings.FIRST_SUPERUSER_PASSWORD,
    }
    r = client.post(
        f"{settings.API_V1_STR}/login/access-token", data=login_data
    )
    tokens = r.json()
    assert r.status_code == 200
    assert "access_token" in tokens
    assert tokens["access_token"]


def test_get_access_token_incorrect_password(client: TestClient) -> None:
    login_data = {
        "username": settings.FIRST_SUPERUSER,
        "password": "incorrect",
    }
    r = client.post(
        f"{settings.API_V1_STR}/login/access-token", data=login_data
    )
    assert r.status_code == 400


def test_use_access_token(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    r = client.post(
        f"{settings.API_V1_STR}/login/test-token",
        headers=superuser_token_headers,
    )
    result = r.json()
    assert r.status_code == 200
    assert "email" in result


def test_device_initiate(client: TestClient) -> None:
    r = client.post(f"{settings.API_V1_STR}/login/device")
    assert r.status_code == 200
    data = r.json()
    assert "device_code" in data
    assert "verification_uri" in data
    assert data["verification_uri"].endswith(
        f"?device_code={data['device_code']}"
    )
    assert data["expires_in"] > 0
    assert data["interval"] > 0


def test_device_token_pending(client: TestClient, db: Session) -> None:
    auth_request = DeviceAuth(
        device_code="pending-device-code",
        expires=utcnow() + timedelta(minutes=5),
    )
    db.add(auth_request)
    db.commit()
    r = client.post(
        f"{settings.API_V1_STR}/login/device/token",
        json={"device_code": auth_request.device_code},
    )
    assert r.status_code == 202
    assert r.json() == {"detail": "Authorization pending"}


def test_device_token_expired(client: TestClient, db: Session) -> None:
    auth_request = DeviceAuth(
        device_code="expired-device-code",
        expires=utcnow() - timedelta(minutes=1),
    )
    db.add(auth_request)
    db.commit()
    r = client.post(
        f"{settings.API_V1_STR}/login/device/token",
        json={"device_code": auth_request.device_code},
    )
    assert r.status_code == 400


def test_device_authorize_and_token(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
) -> None:
    # Initiate
    r = client.post(f"{settings.API_V1_STR}/login/device")
    assert r.status_code == 200
    device_code = r.json()["device_code"]

    # Authorize (requires auth)
    r = client.post(
        f"{settings.API_V1_STR}/login/device/authorize",
        json={"device_code": device_code},
        headers=superuser_token_headers,
    )
    assert r.status_code == 200
    assert r.json() == {"message": "CLI access authorized"}

    # Poll for token — should now succeed
    r = client.post(
        f"{settings.API_V1_STR}/login/device/token",
        json={"device_code": device_code},
    )
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data["access_token"].startswith("ckp_")

    # Row should be deleted — second poll returns 404
    r = client.post(
        f"{settings.API_V1_STR}/login/device/token",
        json={"device_code": device_code},
    )
    assert r.status_code == 404


def test_device_authorize_requires_auth(
    client: TestClient, db: Session
) -> None:
    auth_request = DeviceAuth(
        device_code="unauthed-device-code",
        expires=utcnow() + timedelta(minutes=5),
    )
    db.add(auth_request)
    db.commit()
    r = client.post(
        f"{settings.API_V1_STR}/login/device/authorize",
        json={"device_code": auth_request.device_code},
    )
    assert r.status_code == 401


def test_device_authorize_expired(
    client: TestClient,
    db: Session,
    superuser_token_headers: dict[str, str],
) -> None:
    auth_request = DeviceAuth(
        device_code="expired-auth-code",
        expires=utcnow() - timedelta(minutes=1),
    )
    db.add(auth_request)
    db.commit()
    r = client.post(
        f"{settings.API_V1_STR}/login/device/authorize",
        json={"device_code": auth_request.device_code},
        headers=superuser_token_headers,
    )
    assert r.status_code == 400


@pytest.mark.skip(reason="Password reset not supported with GitHub-only auth")
def test_recovery_password(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    with (
        patch("app.config.settings.SMTP_HOST", "smtp.example.com"),
        patch("app.config.settings.SMTP_USER", "admin@example.com"),
    ):
        email = "test@example.com"
        r = client.post(
            f"{settings.API_V1_STR}/password-recovery/{email}",
            headers=normal_user_token_headers,
        )
        assert r.status_code == 200
        assert r.json() == {"message": "Password recovery email sent"}


@pytest.mark.skip(reason="Password reset not supported with GitHub-only auth")
def test_recovery_password_user_not_exits(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    email = "jVgQr@example.com"
    r = client.post(
        f"{settings.API_V1_STR}/password-recovery/{email}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 404


@pytest.mark.skip(reason="Password reset not supported with GitHub-only auth")
def test_reset_password(
    client: TestClient, superuser_token_headers: dict[str, str], db: Session
) -> None:
    token = generate_password_reset_token(email=settings.FIRST_SUPERUSER)
    data = {"new_password": "changethis", "token": token}
    r = client.post(
        f"{settings.API_V1_STR}/reset-password/",
        headers=superuser_token_headers,
        json=data,
    )
    assert r.status_code == 200
    assert r.json() == {"message": "Password updated successfully"}

    user_query = select(User).where(User.email == settings.FIRST_SUPERUSER)
    user = db.exec(user_query).first()
    assert user
    assert verify_password(data["new_password"], user.hashed_password)


@pytest.mark.skip(reason="Password reset not supported with GitHub-only auth")
def test_reset_password_invalid_token(
    client: TestClient, superuser_token_headers: dict[str, str]
) -> None:
    data = {"new_password": "changethis", "token": "invalid"}
    r = client.post(
        f"{settings.API_V1_STR}/reset-password/",
        headers=superuser_token_headers,
        json=data,
    )
    response = r.json()

    assert "detail" in response
    assert r.status_code == 400
    assert response["detail"] == "Invalid token"
