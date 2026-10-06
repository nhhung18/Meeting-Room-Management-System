import logging
import time

from fastapi import FastAPI, Request

from app.api import health
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.request_id import REQUEST_ID_HEADER, request_id_ctx, resolve_request_id

settings = get_settings()
configure_logging(settings.service_name, settings.log_level)
logger = logging.getLogger("app.access")

app = FastAPI(
    title="Booking Service",
    version="0.1.0",
    docs_url=f"{settings.api_prefix}/docs",
    openapi_url=f"{settings.api_prefix}/openapi.json",
    redoc_url=None,
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Gắn request ID vào context, đo thời gian xử lý và ghi một dòng access log."""
    request_id = resolve_request_id(request.headers.get(REQUEST_ID_HEADER))
    token = request_id_ctx.set(request_id)
    started = time.perf_counter()
    try:
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        logger.info(
            "request completed",
            extra={
                "fields": {
                    "method": request.method,
                    "path": request.url.path,
                    "status": response.status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 2),
                }
            },
        )
        return response
    finally:
        request_id_ctx.reset(token)


# /health nội bộ cho Docker healthcheck; /api/bookings/health cho truy cập qua Nginx.
app.include_router(health.router)
app.include_router(health.router, prefix=settings.api_prefix, include_in_schema=False)
