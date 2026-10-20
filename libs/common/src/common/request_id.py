"""Correlation ID (Request ID) cho mỗi request/message.

Nginx gắn header X-Request-ID; service đọc nó, đưa vào mọi dòng log và trả lại trong
response. ID này cũng được gắn vào RabbitMQ messages để lần theo request xuyên qua nhiều
service (yêu cầu FR-08).
"""

import re
import uuid
from contextvars import ContextVar

REQUEST_ID_HEADER = "X-Request-ID"

# ContextVar giữ giá trị riêng cho từng request/task, kể cả khi chạy đồng thời.
request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

# Chỉ chấp nhận ID ngắn, ký tự an toàn, để client không thể chèn nội dung bậy vào log.
_VALID_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,128}$")


def resolve_request_id(incoming: str | None) -> str:
    """Dùng lại ID từ header/payload nếu hợp lệ, ngược lại sinh ID mới."""
    if incoming and _VALID_REQUEST_ID.match(incoming):
        return incoming
    return uuid.uuid4().hex
