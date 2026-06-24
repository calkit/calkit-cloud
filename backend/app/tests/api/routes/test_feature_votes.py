from app.config import settings
from app.models import FeatureVote
from fastapi.testclient import TestClient
from sqlmodel import Session, delete

FEATURE = "external-releases-in-app"


def test_get_feature_vote_status(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/feature-votes/{FEATURE}",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["feature"] == FEATURE
    assert data["has_voted"] is False


def test_unknown_feature_404(
    client: TestClient, normal_user_token_headers: dict[str, str]
) -> None:
    r = client.get(
        f"{settings.API_V1_STR}/feature-votes/bogus",
        headers=normal_user_token_headers,
    )
    assert r.status_code == 404


def test_cast_feature_vote_is_idempotent(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    try:
        r = client.post(
            f"{settings.API_V1_STR}/feature-votes/{FEATURE}",
            headers=normal_user_token_headers,
        )
        assert r.status_code == 200
        first = r.json()
        assert first["has_voted"] is True
        assert first["count"] >= 1
        r = client.post(
            f"{settings.API_V1_STR}/feature-votes/{FEATURE}",
            headers=normal_user_token_headers,
        )
        assert r.status_code == 200
        second = r.json()
        assert second["has_voted"] is True
        # Voting again must not increment the count.
        assert second["count"] == first["count"]
    finally:
        # The test DB is the shared dev DB, so clean up the vote we cast --
        # otherwise it shows up in the real UI.
        db.exec(delete(FeatureVote).where(FeatureVote.feature == FEATURE))
        db.commit()


def test_remove_feature_vote(
    client: TestClient, normal_user_token_headers: dict[str, str], db: Session
) -> None:
    try:
        client.post(
            f"{settings.API_V1_STR}/feature-votes/{FEATURE}",
            headers=normal_user_token_headers,
        )
        r = client.delete(
            f"{settings.API_V1_STR}/feature-votes/{FEATURE}",
            headers=normal_user_token_headers,
        )
        assert r.status_code == 200
        assert r.json()["has_voted"] is False
        # Removing again is a no-op, not an error.
        r = client.delete(
            f"{settings.API_V1_STR}/feature-votes/{FEATURE}",
            headers=normal_user_token_headers,
        )
        assert r.status_code == 200
        assert r.json()["has_voted"] is False
    finally:
        db.exec(delete(FeatureVote).where(FeatureVote.feature == FEATURE))
        db.commit()
