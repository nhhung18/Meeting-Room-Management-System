import json
import logging

from common.logging import JsonFormatter, configure_logging
from common.request_id import request_id_ctx


def test_json_formatter_outputs_valid_json():
    formatter = JsonFormatter("test-service")
    record = logging.LogRecord("test", logging.INFO, "", 0, "hello", (), None)
    output = formatter.format(record)
    parsed = json.loads(output)
    assert parsed["service"] == "test-service"
    assert parsed["message"] == "hello"
    assert parsed["level"] == "INFO"


def test_json_formatter_includes_request_id():
    token = request_id_ctx.set("req-abc")
    try:
        formatter = JsonFormatter("svc")
        record = logging.LogRecord("test", logging.INFO, "", 0, "msg", (), None)
        parsed = json.loads(formatter.format(record))
        assert parsed["request_id"] == "req-abc"
    finally:
        request_id_ctx.reset(token)


def test_configure_logging_sets_handler(capfd):
    configure_logging("my-svc", "INFO")
    logger = logging.getLogger("test_configure")
    logger.info("check")
    captured = capfd.readouterr()
    # May have multiple JSON lines; find the one with our message
    lines = [l for l in captured.out.strip().splitlines() if l]
    assert any(json.loads(l)["service"] == "my-svc" for l in lines)
