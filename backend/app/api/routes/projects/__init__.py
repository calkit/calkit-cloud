"""Projects related routes."""

from fastapi import APIRouter

from .core import router as core_router
from .fs import router as fs_router

# Re-export all public names (including endpoint functions) from submodules
from .core import *  # noqa: F401,F403
from .fs import *  # noqa: F401,F403

router = APIRouter()
router.include_router(core_router)
router.include_router(fs_router)

# Export router and all other public names imported above
__all__ = [name for name in globals() if not name.startswith("_")]
