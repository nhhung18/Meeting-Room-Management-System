from common.request_id import REQUEST_ID_HEADER, resolve_request_id


def test_valid_request_id_is_reused():
    assert resolve_request_id("abc-123") == "abc-123"


def test_invalid_request_id_is_replaced():
    result = resolve_request_id("bad id\nwith newline")
    assert result != "bad id\nwith newline"
    assert len(result) == 32  # uuid4 hex


def test_none_generates_new_id():
    result = resolve_request_id(None)
    assert len(result) == 32


def test_header_constant():
    assert REQUEST_ID_HEADER == "X-Request-ID"
