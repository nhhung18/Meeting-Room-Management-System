FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Chạy bằng user thường, không dùng root, để giảm thiệt hại nếu service bị tấn công.
RUN useradd --create-home --uid 10001 appuser

# Copy requirements trước code: Docker cache lại bước cài thư viện, chỉ cài lại khi file này đổi.
COPY requirements.txt .
RUN pip install -r requirements.txt

# --chown: code thuộc về appuser, nên chạy được bất kể quyền file trên máy build.
COPY --chown=appuser:appuser app ./app

USER appuser
EXPOSE 8000

# Access log do middleware tự ghi dạng JSON, nên tắt access log mặc định của uvicorn.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
