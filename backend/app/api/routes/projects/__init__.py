"""Projects related routes."""

from fastapi import APIRouter

from .core import router as core_router
from .fs import router as fs_router

router = APIRouter()
router.include_router(core_router)
router.include_router(fs_router)

__all__ = ["router"]
