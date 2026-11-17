"""Unit tests cho PolicyService — caching, invalidation, fallback default."""

from unittest.mock import MagicMock

from app.services.policy_service import _DEFAULTS, PolicyService


class _FakeSessionCtx:
    def __init__(self, policy_value):
        self.policy_value = policy_value

    def __enter__(self):
        session = MagicMock()
        # Build a fake SystemPolicy with .value attribute
        if self.policy_value is None:
            fake_policy = None
        else:
            fake_policy = MagicMock()
            fake_policy.value = self.policy_value
        # SystemPolicyRepository.get(key) → .execute().scalar_one_or_none()
        session.execute.return_value.scalar_one_or_none.return_value = fake_policy
        return session

    def __exit__(self, *args):
        return False


def _factory(value_sequence):
    """Trả về session_factory: mỗi lần gọi tạo một session trả giá trị kế tiếp."""
    it = iter(value_sequence)

    def factory():
        return _FakeSessionCtx(next(it))

    return factory


class TestPolicyService:
    def test_get_returns_db_value(self):
        svc = PolicyService(_factory([30]))
        assert svc.get("check_in_window_minutes") == 30

    def test_get_returns_default_when_policy_missing(self):
        svc = PolicyService(_factory([None]))
        assert svc.get("check_in_window_minutes") == 15

    def test_get_returns_default_when_key_unknown_and_missing(self):
        svc = PolicyService(_factory([None]))
        assert svc.get("some_unknown_key") is None

    def test_get_caches_value(self):
        # Chỉ có một value trong sequence → gọi lần 2 phải lấy từ cache
        svc = PolicyService(_factory([20]))
        assert svc.get("check_in_window_minutes") == 20
        # Nếu không cache, dòng dưới sẽ raise StopIteration
        assert svc.get("check_in_window_minutes") == 20

    def test_invalidate_forces_refresh(self):
        svc = PolicyService(_factory([20, 45]))
        assert svc.get("check_in_window_minutes") == 20
        svc.invalidate("check_in_window_minutes")
        assert svc.get("check_in_window_minutes") == 45

    def test_invalidate_all(self):
        svc = PolicyService(_factory([20, 45]))
        assert svc.get("check_in_window_minutes") == 20
        svc.invalidate()  # no arg → clear all
        assert svc.get("check_in_window_minutes") == 45

    def test_get_check_in_window_minutes_returns_int(self):
        svc = PolicyService(_factory([25]))
        assert svc.get_check_in_window_minutes() == 25
        assert isinstance(svc.get_check_in_window_minutes(), int)

    def test_get_check_in_window_minutes_fallback_on_bad_value(self):
        svc = PolicyService(_factory(["not-a-number"]))
        assert svc.get_check_in_window_minutes() == _DEFAULTS["check_in_window_minutes"]

    def test_db_error_returns_default(self):
        # session_factory raise → fallback to default
        def broken_factory():
            raise RuntimeError("DB down")

        svc = PolicyService(broken_factory)
        assert svc.get("check_in_window_minutes") == 15
