"""PolicyService — đọc policy từ DB với in-memory cache (TTL 60s).

Giảm DB load khi mỗi request check-in / mỗi vòng auto-cancel đều cần policy value.
Cache tự động invalidate khi `invalidate_cache()` được gọi (API update).

Fallback: nếu DB lỗi hoặc policy chưa tồn tại, trả về default value.
"""

import logging
import threading
import time
from typing import Any

from app.repositories.system_policy_repository import SystemPolicyRepository

logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 60
_DEFAULTS: dict[str, Any] = {
    "check_in_window_minutes": 15,
}


class PolicyService:
    """Thread-safe singleton policy cache."""

    def __init__(self, session_factory) -> None:
        self._session_factory = session_factory
        self._cache: dict[str, tuple[Any, float]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Any:
        """Lấy policy value — đọc cache nếu còn fresh, nếu không query DB."""
        with self._lock:
            cached = self._cache.get(key)
            if cached is not None:
                value, expires_at = cached
                if time.monotonic() < expires_at:
                    return value

        # Cache miss hoặc expired — query DB
        try:
            with self._session_factory() as session:
                repo = SystemPolicyRepository(session)
                policy = repo.get(key)
                value = policy.value if policy is not None else _DEFAULTS.get(key)
        except Exception:
            logger.exception(
                "policy lookup failed, returning default",
                extra={"fields": {"key": key}},
            )
            value = _DEFAULTS.get(key)

        with self._lock:
            self._cache[key] = (value, time.monotonic() + _CACHE_TTL_SECONDS)
        return value

    def invalidate(self, key: str | None = None) -> None:
        """Xóa cache. None = xóa toàn bộ."""
        with self._lock:
            if key is None:
                self._cache.clear()
            else:
                self._cache.pop(key, None)

    def get_check_in_window_minutes(self) -> int:
        """Shortcut typed cho policy phổ biến nhất."""
        value = self.get("check_in_window_minutes")
        try:
            return int(value)
        except (TypeError, ValueError):
            return _DEFAULTS["check_in_window_minutes"]


# ---------------------------------------------------------------------------
# Lazy singleton — khởi tạo khi cần, dùng session_factory từ db module
# ---------------------------------------------------------------------------

_instance: PolicyService | None = None
_instance_lock = threading.Lock()


def get_policy_service() -> PolicyService:
    """FastAPI dependency / helper — trả về singleton PolicyService."""
    global _instance
    if _instance is None:
        with _instance_lock:
            if _instance is None:
                from app.db.session import _session_factory

                _instance = PolicyService(_session_factory())
    return _instance


def _reset_for_tests() -> None:
    """Chỉ dùng cho tests: xóa singleton + cache."""
    global _instance
    with _instance_lock:
        _instance = None
