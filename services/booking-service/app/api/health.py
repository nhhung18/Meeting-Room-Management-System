from fastapi import APIRouter, Depends, Response, status

from app.core.config import get_settings
from app.db.session import database_is_healthy

router = APIRouter(tags=["health"])


@router.get("/health")
def health(response: Response, db_ok: bool = Depends(database_is_healthy)) -> dict[str, str]:
    """Trả 200 khi service và DB đều ổn, 503 khi DB không kết nối được.

    Docker healthcheck và Nginx dựa vào mã trạng thái này để biết instance nào còn dùng được.
    """
    if not db_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "ok" if db_ok else "degraded",
        "service": get_settings().service_name,
        "database": "ok" if db_ok else "unavailable",
    }
