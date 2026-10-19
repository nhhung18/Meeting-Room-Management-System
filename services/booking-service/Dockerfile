FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=10

WORKDIR /app

# Chạy bằng user thường, không dùng root, để giảm thiệt hại nếu service bị tấn công.
RUN useradd --create-home --uid 10001 appuser

# Cài libs/common trước (ít thay đổi hơn service code → Docker cache tốt hơn).
# Build context là project root (docker-compose dùng context: .).
COPY libs/common/ ./libs/common/
RUN pip install -e ./libs/common

# Copy requirements trước code: Docker cache lại bước cài thư viện.
# requirements-dev.txt cài thêm pytest/ruff để `make test-integration` chạy được trong container.
COPY services/booking-service/requirements.txt services/booking-service/requirements-dev.txt ./
RUN pip install -r requirements-dev.txt

# --chown: code thuộc về appuser, nên chạy được bất kể quyền file trên máy build.
COPY --chown=appuser:appuser services/booking-service/app ./app
COPY --chown=appuser:appuser services/booking-service/alembic.ini ./alembic.ini
COPY --chown=appuser:appuser services/booking-service/alembic ./alembic
COPY --chown=appuser:appuser services/booking-service/tests ./tests
COPY --chown=appuser:appuser services/booking-service/pyproject.toml ./pyproject.toml

USER appuser
EXPOSE 8000

# Access log do middleware tự ghi dạng JSON, nên tắt access log mặc định của uvicorn.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
