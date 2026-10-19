"""FastAPI app cho notification-worker.

HTTP server phục vụ /health cho Docker healthcheck.
Worker loop chạy song song trong asyncio task khi app khởi động.
"""

import asyncio
import logging

from fastapi import FastAPI

from app.core.config import get_settings
from app.core.logging import configure_logging

settings = get_settings()
configure_logging(settings.service_name, settings.log_level)
logger = logging.getLogger("app")

app = FastAPI(
    title="Notification Worker",
    version="0.1.0",
    docs_url=f"{settings.api_prefix}/docs",
    openapi_url=f"{settings.api_prefix}/openapi.json",
    redoc_url=None,
)

_worker_task: asyncio.Task | None = None


@app.on_event("startup")
async def start_worker() -> None:
    """Khởi động worker loop khi FastAPI start; giữ reference để không bị GC."""
    global _worker_task
    from app.worker import run_worker

    _worker_task = asyncio.create_task(run_worker(), name="notification-worker")
    _worker_task.add_done_callback(_on_worker_done)
    logger.info("worker task started")


def _on_worker_done(task: asyncio.Task) -> None:
    if task.cancelled():
        logger.info("worker task cancelled")
        return
    exc = task.exception()
    if exc:
        # Log lỗi nhưng không crash HTTP server — healthcheck sẽ fail khi cần.
        logger.error("worker task crashed", extra={"fields": {"error": str(exc)}})


@app.on_event("shutdown")
async def stop_worker() -> None:
    if _worker_task and not _worker_task.done():
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass


@app.get("/health")
@app.get(f"{settings.api_prefix}/health", include_in_schema=False)
async def health() -> dict:
    worker_alive = _worker_task is not None and not _worker_task.done()
    return {
        "status": "ok",
        "service": settings.service_name,
        "worker": "running" if worker_alive else "stopped",
    }
