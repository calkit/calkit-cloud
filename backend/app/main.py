"""Main FastAPI application and entry point for the Calkit Cloud backend."""

import logging

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from git.exc import GitCommandError
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.config import settings

logger = logging.getLogger(__name__)


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


if settings.SENTRY_DSN and settings.ENVIRONMENT != "local":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
)

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            str(origin).strip("/") for origin in settings.BACKEND_CORS_ORIGINS
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.exception_handler(GitCommandError)
async def git_command_error_handler(
    request: Request, exc: GitCommandError
) -> JSONResponse:
    logger.error("Git command error: %s", exc.stderr or str(exc))
    stderr = (exc.stderr or "").lower()
    if "403" in stderr or "permission" in stderr or "denied" in stderr:
        return JSONResponse(
            status_code=403,
            content={
                "detail": (
                    "Git remote denied permission. Possible causes: "
                    "you do not have write access to this repository, "
                    "or the Calkit GitHub app has not been granted access "
                    "to it."
                )
            },
        )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "A Git operation failed; check server logs for details."
        },
    )


app.include_router(api_router, prefix=settings.API_V1_STR)
