from app.api.routes import (
    accounts,
    login,
    misc,
    projects,
    users,
    orgs,
    datasets,
)
from fastapi import APIRouter

api_router = APIRouter()
api_router.include_router(accounts.router, tags=["accounts"])
api_router.include_router(login.router, tags=["login"])
api_router.include_router(users.router, tags=["users"])
api_router.include_router(misc.router, tags=["misc"])
api_router.include_router(projects.router, tags=["projects"])
api_router.include_router(orgs.router, tags=["orgs"])
api_router.include_router(datasets.router, tags=["datasets"])
