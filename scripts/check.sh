#!/usr/bin/env bash
set -e

echo "▶ libs/common"
(cd libs/common && ruff check src/ tests/ && ruff format --check src/ tests/ && python -m pytest -q)

echo "▶ booking-service"
(cd services/booking-service && ruff check . && ruff format --check . && python -m pytest -q)

echo "▶ room-service"
(cd services/room-service && ruff check app/ tests/ && ruff format --check app/ tests/ && python -m pytest -q)

echo "▶ notification-worker"
(cd services/notification-worker && ruff check app/ tests/ && ruff format --check app/ tests/ && python -m pytest -q)

echo "✅ OK"
