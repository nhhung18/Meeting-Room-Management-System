#!/bin/sh
# Tạo database + user riêng cho từng service (database-per-service, xem ADR-0002).
# Script chỉ chạy MỘT LẦN, khi volume Postgres còn trống.
# Đổi script hoặc mật khẩu sau đó thì cần xóa volume: `make reset-db`.
set -eu

create_service_db() {
  db="$1"
  user="$2"
  password="$3"

  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
    -v db="$db" -v user="$user" -v password="$password" <<-'EOSQL'
	CREATE ROLE :"user" LOGIN PASSWORD :'password';
	CREATE DATABASE :"db" OWNER :"user";
	-- Mặc định mọi user được kết nối vào mọi database. Thu hồi quyền đó để
	-- user của service này KHÔNG kết nối được vào database của service khác.
	REVOKE CONNECT ON DATABASE :"db" FROM PUBLIC;
	GRANT CONNECT ON DATABASE :"db" TO :"user";
EOSQL
}

create_service_db booking_db booking_user "$BOOKING_DB_PASSWORD"
create_service_db room_db room_user "$ROOM_DB_PASSWORD"
