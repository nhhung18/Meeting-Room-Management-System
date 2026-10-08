.PHONY: help setup up down logs ps test lint format reset-db

BOOKING := services/booking-service

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
