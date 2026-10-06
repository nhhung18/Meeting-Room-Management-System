# ADR-0001: Dùng Nginx làm API Gateway (không viết Gateway service riêng)

- **Trạng thái:** Accepted
- **Ngày:** 2026-10-05

## Bối cảnh
Đề bài yêu cầu một API Gateway làm "điểm truy cập chung, routing và rate limiting", đồng thời bắt buộc dùng Nginx làm reverse proxy + load balancer cho ≥2 instance Booking Service. Dự án làm một mình trong ~8 tuần.

## Các phương án
| | A. Nginx kiêm Gateway | B. FastAPI Gateway riêng sau Nginx |
|---|---|---|
| Số service phải code | Ít hơn 1 | Thêm 1 |
| Xác thực JWT | Từng service tự xác thực | Tập trung tại Gateway |
| Rate limit | Nginx `limit_req` (theo IP) | Có thể theo user |
| Độ trễ | 1 hop | 2 hop |
| Điểm lỗi | Nginx | Nginx + Gateway |

## Quyết định
Chọn **A**. Nginx đảm nhận: routing theo path, load balancing, rate limiting (tuần 6), sinh `X-Request-ID`, phục vụ build React (cùng origin, giảm vấn đề CORS). Mỗi backend service tự xác thực JWT Auth0 (RS256, JWKS) và tự kiểm tra RBAC.

## Hệ quả
**Tích cực**
- Bớt một service phải code, test và vận hành.
- Mỗi service tự xác thực, không mặc định tin tưởng mạng nội bộ (defense in depth).
- Service hoàn toàn stateless, dễ scale ngang.

**Tiêu cực / cần xử lý**
- Logic xác thực JWT lặp lại ở nhiều service, cần chọn cách chia sẻ code (câu hỏi mở).
- Rate limit chỉ theo IP, không theo user (Nginx bản miễn phí không đọc JWT). Ghi vào danh sách hạn chế.
- Nginx là single point of failure. Trong Compose dùng `restart: unless-stopped` + healthcheck. Ghi vào danh sách hạn chế.

## Câu hỏi mở
- Chia sẻ code xác thực JWT giữa các service: copy / shared package nội bộ / Nginx `auth_request`? Quyết định ở tuần 2.
