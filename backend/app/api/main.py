from app.api.routes import items, login, misc, projects, users
from fastapi import APIRouter

api_router = APIRouter()
api_router.include_router(login.router, tags=["login"])
api_router.include_router(users.router, tags=["users"])
api_router.include_router(misc.router, tags=["misc"])
api_router.include_router(items.router, prefix="/items", tags=["items"])
api_router.include_router(projects.router, tags=["projects"])
