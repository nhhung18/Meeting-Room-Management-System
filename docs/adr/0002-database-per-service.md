# ADR-0002: Mỗi service một database + user riêng trên cùng một Postgres server

- **Trạng thái:** Accepted
- **Ngày:** 2026-10-05

## Bối cảnh
Đề bài cho phép dùng chung một PostgreSQL server, nhưng mỗi service phải sở hữu dữ liệu riêng và không được truy cập trực tiếp bảng của service khác.

## Các phương án
| | A. Chung DB, mỗi service 1 schema | B. Chung server, mỗi service 1 database + user | C. Mỗi service 1 Postgres container |
|---|---|---|---|
| Mức cách ly | Yếu: dễ lỡ tay JOIN chéo schema nếu phân quyền sai | Mạnh: user của service A không kết nối được DB của B | Mạnh nhất |
| Tài nguyên | Ít | Ít | Nhiều (mỗi container tốn RAM) |
| Vận hành / backup | Đơn giản | Đơn giản (1 server) | Phức tạp hơn |

## Quyết định
Chọn **B**. Script `infra/postgres/init/01-create-databases.sh` tạo `booking_db` / `booking_user` và `room_db` / `room_user`, đồng thời thu hồi quyền `CONNECT` mặc định của `PUBLIC`, nên ranh giới được database cưỡng chế chứ không chỉ dựa vào quy ước.

## Hệ quả
**Tích cực**
- Vi phạm ranh giới sẽ lỗi ngay khi kết nối, không thể vô tình xảy ra.
- Vẫn chỉ một container Postgres, nhẹ cho máy cá nhân và CI.
- Sau này tách ra server riêng chỉ cần đổi `DATABASE_URL`.

**Tiêu cực / cần xử lý**
- Không thể JOIN dữ liệu Room với Booking. Booking cần thông tin phòng (trạng thái, sức chứa) phải lấy qua API hoặc event. Đây là bài toán ranh giới dữ liệu, cần ADR riêng trước khi vẽ ERD.
- Postgres server vẫn là điểm lỗi chung của mọi service. Chấp nhận trong phạm vi dự án; ghi vào danh sách hạn chế.
- Script init chỉ chạy khi volume còn trống; đổi script phải `make reset-db` (mất dữ liệu local).
