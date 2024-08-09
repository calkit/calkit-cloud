"""GitHub related functionality."""

import os
import time

import jwt


def create_app_token() -> str:
    pem_fpath = "../../calkit.2024-08-08.private-key.pem"
    client_id = os.environ["GITHUB_CLIENT_ID"]
    # Open PEM
    with open(pem_fpath, "rb") as pem_file:
        signing_key = pem_file.read()
    payload = {
        # Issued at time
        "iat": int(time.time()),
        # JWT expiration time (10 minutes maximum)
        "exp": int(time.time()) + 600,
        # GitHub App's client ID
        "iss": client_id,
    }
    # Create JWT
    encoded_jwt = jwt.encode(payload, signing_key, algorithm="RS256")
    return encoded_jwt
