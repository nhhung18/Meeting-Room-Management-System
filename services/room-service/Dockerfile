FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=10

WORKDIR /app

RUN useradd --create-home --uid 10001 appuser

# Cài libs/common trước — ít thay đổi hơn service code → Docker cache tốt hơn.
COPY libs/common/ ./libs/common/
RUN pip install -e ./libs/common

COPY services/room-service/requirements.txt services/room-service/requirements-dev.txt ./
RUN pip install -r requirements-dev.txt

COPY --chown=appuser:appuser services/room-service/app ./app
COPY --chown=appuser:appuser services/room-service/tests ./tests
COPY --chown=appuser:appuser services/room-service/pyproject.toml ./pyproject.toml

USER appuser
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
