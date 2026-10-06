# Architecture Decision Records (ADR)

Mỗi quyết định kiến trúc quan trọng được ghi thành một file ngắn, đánh số tăng dần.
ADR đã "Accepted" thì không sửa nội dung quyết định; nếu đổi ý, viết ADR mới và đánh dấu ADR cũ là "Superseded by ADR-XXXX".

| # | Quyết định | Trạng thái |
|---|---|---|
| [0001](0001-nginx-as-api-gateway.md) | Dùng Nginx làm API Gateway | Accepted |
| [0002](0002-database-per-service.md) | Mỗi service một database + user riêng trên cùng một Postgres server | Accepted |

## Mẫu

```markdown
# ADR-XXXX: <Tiêu đề>

- **Trạng thái:** Proposed | Accepted | Superseded by ADR-YYYY
- **Ngày:** YYYY-MM-DD

## Bối cảnh
Vấn đề cần quyết định là gì, có ràng buộc gì.

## Các phương án
Liệt kê 2-3 phương án, ưu và nhược điểm.

## Quyết định
Chọn phương án nào.

## Hệ quả
Được gì, mất gì, cần xử lý thêm gì. Nếu thành phần liên quan bị sập thì hệ thống phục hồi ra sao.
```
