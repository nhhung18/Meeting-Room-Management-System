.PHONY: help setup up down logs ps test lint format reset-db migrate test-integration test-common test-worker test-room migrate-room test-room-integration seed token

BOOKING := services/booking-service
COMMON := libs/common
WORKER := services/notification-worker
ROOM := services/room-service

help: ## Liệt kê các lệnh
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  %-10s %s\n", $$1, $$2}'

setup: ## Tạo .env từ mẫu (nếu chưa có) và cài pre-commit hook
	@test -f .env || cp .env.example .env
	pre-commit install

up: ## Build và chạy toàn bộ hệ thống
	docker compose up --build -d --wait

down: ## Dừng hệ thống (giữ dữ liệu)
	docker compose down

logs: ## Xem log tất cả service
	docker compose logs -f

ps: ## Trạng thái các container
	docker compose ps

test: ## Chạy test của booking-service
	cd $(BOOKING) && python -m pytest

lint: ## Kiểm tra code style
	cd $(BOOKING) && ruff check . && ruff format --check .

format: ## Tự format code
	cd $(BOOKING) && ruff check --fix . && ruff format .

reset-db: ## XÓA dữ liệu Postgres và khởi tạo lại từ đầu
	docker compose down -v

migrate: ## Chạy migration mới nhất trên booking_db trong Docker
	docker compose run --rm booking-service alembic upgrade head

test-integration: ## Chạy integration test trên DB thật trong Docker (migrate trước)
	docker compose run --rm booking-service sh -c "alembic upgrade head && python -m pytest -m integration -v"

test-common: ## Chạy test của libs/common
	cd $(COMMON) && .venv-local/bin/python -m pytest -v 2>/dev/null || python -m pytest -v

test-worker: ## Chạy test của notification-worker
	cd $(WORKER) && .venv-local/bin/python -m pytest -v 2>/dev/null || python -m pytest -v

test-room: ## Chạy test của room-service
	cd $(ROOM) && .venv-local/bin/python -m pytest -v 2>/dev/null || python -m pytest -v

migrate-room: ## Chạy migration mới nhất trên room_db trong Docker
	docker compose run --rm room-service alembic upgrade head

test-room-integration: ## Chạy integration tests của room-service trong Docker (migrate trước)
	docker compose run --rm room-service sh -c "alembic upgrade head && python -m pytest -m integration -v"

seed: ## Chèn demo rooms vào room_db (idempotent)
	docker compose run --rm room-service sh -c "alembic upgrade head && python scripts/seed.py"

token: ## Lấy Auth0 JWT token (make token ROLE=m2m|employee|manager|admin)
	scripts/get-token.sh $(or $(ROLE),m2m) | python3 -m json.tool
