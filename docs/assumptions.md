# Các Giả Định Kinh Doanh (Business Assumptions)

Tài liệu này ghi lại các giả định kinh doanh mà hệ thống đưa ra. Mỗi giả định ảnh hưởng tới thiết kế database, logic validation, và behavior của hệ thống.

**Cập nhật lần cuối:** 2026-10-09

---

## 1. Khoảng đặt là Half-Open `[start, end)`

### Giả định
Hai booking không trùng lịch nếu và chỉ nếu khoảng thời gian không overlap. Cụ thể, khoảng `[09:00, 10:00)` và `[10:00, 11:00)` **không trùng**.

Ví dụ:
- Booking A: 09:00 – 10:00 (half-open: chứa 09:00, **không** chứa 10:00)
- Booking B: 10:00 – 11:00 (half-open: chứa 10:00, không chứa 11:00)
- **Kết quả:** A và B không trùng; phòng có thể được sử dụng liên tục

### Lý do
- Phòng họp hiếm khi cần "buffer time" giữa 2 cuộc họp (đó là quyết định riêng của user).
- Tiết kiệm khoảng thời gian; tối ưu sử dụng phòng.
- Half-open intervals là chuẩn trong lập trình (Python ranges, SQL BETWEEN, v.v.).

### Ảnh hưởng trên code

**Database Constraint:**
```sql
-- PostgreSQL exclusion constraint: 2 bookings không được overlap
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings
EXCLUDE USING gist (room_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&)
WHERE (status IN ('CONFIRMED', 'CHECKED_IN'));

-- tstzrange(..., '[)') = half-open: chứa start, không chứa end
-- && = overlap operator
```

**Application Pre-check:**
```python
# booking-service/app/services/booking.py
async def check_overlap(room_id: int, start_at: datetime, end_at: datetime, db: Session):
    """Check if [start_at, end_at) conflicts with existing bookings."""
    overlap = db.query(Booking).filter(
        Booking.room_id == room_id,
        Booking.start_at < end_at,      # ← existing.start < new.end
        Booking.end_at > start_at,      # ← existing.end > new.start
        Booking.status.in_(["CONFIRMED", "CHECKED_IN"])
    ).first()
    return overlap is not None
```

---

## 2. Kiểm tra Dung tích: Số người ≤ Dung tích phòng

### Giả định
Khi user đặt phòng, hệ thống phải đảm bảo **số lượng người tham dự ≤ sức chứa của phòng**.

Ví dụ:
- Phòng P101: capacity = 15
- User đặt với 18 người → **bị chặn** (booking không được tạo)
- User đặt với 15 người → **được phép** (đầy phòng, nhưng ok)

### Lý do
- Yêu cầu an toàn và pháp lý: mật độ người trong phòng có giới hạn.
- Thỏa mãn yêu cầu FR-03 (tìm phòng): user query theo capacity.

### Ảnh hưởng trên code

**Schema:**
```sql
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL,
    num_attendees INTEGER NOT NULL CHECK (num_attendees > 0),
    -- ...
);

-- Constraint toàn vẹn: được check tại booking time
-- CREATE TRIGGER ensure_capacity BEFORE INSERT ON bookings
-- FOR EACH ROW: if (select capacity from rooms where id = new.room_id) < new.num_attendees then raise
```

**Validation:**
```python
# booking-service/app/services/booking.py
async def create_booking(req: BookingRequest, db: Session):
    room_snap = db.query(RoomSnapshot).filter_by(room_id=req.room_id).first()
    
    if req.num_attendees > room_snap.capacity:
        raise HTTPException(
            400,
            f"Số người {req.num_attendees} vượt dung tích phòng ({room_snap.capacity})"
        )
```

---

## 3. Phòng Chuyển MAINTENANCE: Đặt tương lai bị chặn, Chủ được thông báo

### Giả định
Khi phòng chuyển sang trạng thái **MAINTENANCE** (sửa chữa, bảo trì):
1. **Booking mới** trong tương lai **bị chặn** (không thể tạo).
2. **Booking cũ** (đã xác nhận trong quá khứ) **không bị hủy tự động**.
3. **Chủ sở hữu phòng** được thông báo (event RabbitMQ).

Ví dụ:
- Admin: "P101 → MAINTENANCE" (2026-10-09, 14:00)
- Booking A (09:00 – 10:00, hôm nay): ✅ vẫn hợp lệ
- Booking B (2026-10-10, 14:00 – 15:00): ❌ không thể tạo (phòng MAINTENANCE)

### Lý do
- **Đặt cũ không bị hủy:** không làm mất công của user (công bằng, tôn trọng); nếu phòng sửa xong sớm, booking vẫn diễn ra bình thường.
- **Đặt mới bị chặn:** tránh confuse; không tạo booking khả năng cao sẽ cancel.
- **Thông báo:** chủ phòng biết sắp có ai đến dùng phòng đang bảo trì → có kế hoạch.

### Ảnh hưởng trên code

**Schema:**
```sql
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    status VARCHAR(50) DEFAULT 'AVAILABLE'
        CHECK (status IN ('AVAILABLE', 'MAINTENANCE', 'ARCHIVED')),
    -- ...
);
```

**Validation:**
```python
# booking-service/app/services/booking.py
async def create_booking(req: BookingRequest, db: Session):
    room_snap = db.query(RoomSnapshot).filter_by(room_id=req.room_id).first()
    
    if room_snap.status != "AVAILABLE":
        raise HTTPException(
            409,
            f"Phòng {room_snap.status}; không thể đặt lúc này"
        )
    
    # Tạo booking...
    # ✅ Booking cũ (trong quá khứ) không kiểm tra, room status change không ảnh hưởng
```

**Event Publish (tuần 5):**
```python
# room-service: khi status thay đổi
await rabbitmq.publish("room.status_changed", {
    "room_id": room_id,
    "old_status": "AVAILABLE",
    "new_status": "MAINTENANCE",
    "timestamp": utcnow()
})

# notification-worker: subscribe → gửi email chủ phòng
# "Phòng P101 chuyển sang MAINTENANCE từ 14:00. 
#  Booking hôm nay (09:00–10:00) vẫn hợp lệ."
```

---

## 4. Timestamps: Lưu UTC `timestamptz`, Hiển thị Asia/Saigon

### Giả định
- **Lưu trữ:** Tất cả timestamps trong database dùng `TIMESTAMP WITH TIME ZONE` (UTC).
- **Hiển thị:** API và Frontend convert sang múi giờ **Asia/Saigon** (UTC+7, không DST).

Ví dụ:
- User ở Saigon: "9 sáng" = 09:00 Asia/Saigon
- Lưu DB: 2026-10-09 02:00:00+00:00 (UTC)
- Trả client: 2026-10-09T09:00:00+07:00

### Lý do
- **UTC lưu:** không phụ thuộc múi giờ, không bị ảnh hưởng DST; dễ so sánh / sort.
- **Asia/Saigon hiển thị:** user Việt Nam thấy giờ địa phương, không confuse.
- **Không DST:** Việt Nam không dùng daylight saving time → múi giờ cố định UTC+7.

### Ảnh hưởng trên code

**Schema:**
```sql
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,  -- UTC
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,    -- UTC
    created_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() AT TIME ZONE 'UTC'),
    -- ...
);
```

**API Response (FastAPI):**
```python
# booking-service/app/schemas/booking.py
from datetime import datetime

class BookingResponse(BaseModel):
    id: int
    start_at: datetime  # Pydantic serialize theo local tz (client-side convert)
    end_at: datetime
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# Trả client: "2026-10-09T09:00:00+07:00"
```

**Conversion (tuần 7, frontend):**
```typescript
// React
const saigonTime = new Date(booking.start_at)
  .toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
// Output: "9:00:00 AM" (Asia/Ho_Chi_Minh = Saigon)
```

---

## 5. Đặt Không Thể Bắt Đầu Ở Quá Khứ

### Giả định
User **không được phép** tạo booking có `start_at` ở quá khứ.

Ví dụ:
- Thời gian hiện tại: 2026-10-09 14:30
- User đặt: start_at = 2026-10-09 13:00 (1.5 giờ trước) → ❌ **bị chặn**
- User đặt: start_at = 2026-10-09 15:00 (30 phút sau) → ✅ **được phép**

### Lý do
- **Logic:** không thể bắt đầu cuộc họp ở quá khứ (time travel không tồn tại).
- **UX:** tránh user lỡ tay book sai giờ.

### Ảnh hưởng trên code

**Validation:**
```python
# booking-service/app/services/booking.py
from datetime import datetime, timezone

async def create_booking(req: BookingRequest, db: Session):
    now = datetime.now(timezone.utc)
    
    if req.start_at <= now:  # ← half-open, nên <= không <
        raise HTTPException(
            400,
            f"start_at phải sau {now.isoformat()}"
        )
```

**Frontend (tuần 7):**
```typescript
// React: disable past time slots trong time picker
const minStartTime = new Date();
minStartTime.setMinutes(minStartTime.getMinutes() + 15); // earliest 15 min from now
// <TimePicker minTime={minStartTime} />
```

---

## 6. Cửa Sổ Check-in: Mở 15 phút trước, Hủy tự động 15 phút sau nếu chưa check-in

### Giả định
Mỗi booking có cửa sổ check-in:
- **Mở:** 15 phút trước `start_at`
- **Đóng & Auto-cancel:** 15 phút sau `start_at` nếu user chưa check-in

Ví dụ:
- Booking: 09:00 – 10:00
- 08:45: ✅ Check-in available (user có thể "có mặt rồi")
- 09:00 – 09:15: ⏳ User trong cửa sổ check-in
- 09:16: ❌ Quá 15 phút → hệ thống tự động cancel booking → phòng giải phóng

### Lý do
- **Buffer 15 phút:** tài xế muộn, lâu tìm phòng, v.v. không bị hủy ngay.
- **Auto-cancel:** tránh "ghost bookings" (user booking rồi không đến) chiếm phòng cả ngày.
- **Timeframe hợp lý:** 15 phút là độ chờ hợp lý trong bối cảnh phòng họp.

### Ảnh hưởng trên code

**Schema:**
```sql
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    status VARCHAR(50) DEFAULT 'CONFIRMED'
        CHECK (status IN ('CONFIRMED', 'CHECKED_IN', 'CANCELLED')),
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    checked_in_at TIMESTAMP WITH TIME ZONE NULL,
    auto_cancelled_at TIMESTAMP WITH TIME ZONE NULL,
    -- ...
);
```

**Check-in Endpoint:**
```python
# booking-service/app/api/bookings.py
from datetime import datetime, timezone, timedelta

@router.post("/api/bookings/{booking_id}/check-in")
async def check_in_booking(booking_id: int, db: Session):
    booking = db.query(Booking).filter_by(id=booking_id).first()
    now = datetime.now(timezone.utc)
    
    # Check cửa sổ check-in: [start - 15min, start + 15min)
    check_in_open = booking.start_at - timedelta(minutes=15)
    check_in_close = booking.start_at + timedelta(minutes=15)
    
    if now < check_in_open or now >= check_in_close:
        raise HTTPException(
            400,
            f"Check-in cửa sổ đã đóng. Mở từ {check_in_open.isoformat()}"
        )
    
    booking.status = "CHECKED_IN"
    booking.checked_in_at = now
    db.commit()
    return {"status": "checked_in"}
```

**Background Job (tuần 5, auto-cancel):**
```python
# booking-service/app/services/auto_cancel.py
# Chạy mỗi 1 phút (APScheduler hoặc RabbitMQ delayed message)

async def cancel_no_checkin():
    """Hủy booking quá 15 phút không check-in"""
    now = datetime.now(timezone.utc)
    
    # Tìm booking: CONFIRMED, start_at + 15min < now
    expired = db.query(Booking).filter(
        Booking.status == "CONFIRMED",
        Booking.start_at + timedelta(minutes=15) <= now
    ).all()
    
    for booking in expired:
        booking.status = "CANCELLED"
        booking.auto_cancelled_at = now
        
        # Publish event: phòng giải phóng
        await rabbitmq.publish("booking.auto_cancelled", {
            "booking_id": booking.id,
            "room_id": booking.room_id,
            "reason": "no_check_in"
        })
    
    db.commit()
    logger.info(f"Auto-cancelled {len(expired)} bookings", extra={"fields": {
        "count": len(expired)
    }})
```

**Notification (tuần 5):**
```python
# notification-worker
@consumer.listen("booking.auto_cancelled")
async def notify_auto_cancelled(message):
    booking_id = message["booking_id"]
    
    # Gửi email user: "Booking #{booking_id} đã hủy do không check-in"
    # Publish: "Phòng #{room_id} giải phóng, có thể đặt lại"
```

---

## Tóm tắt: Các Giả Định và Timeline Cài Đặt

| # | Giả định | Tuần cài đặt | ADR/Task |
|---|---|---|---|
| 1 | Half-open intervals `[start, end)` | 3–4 (FR-04) | Task #5 (ERD), Task #6 (migration) |
| 2 | Capacity check | 3 (FR-04) | Validation + constraint |
| 3 | MAINTENANCE: new blocked, old ok | 4 (FR-04) + 5 (notifications) | room_snapshots status |
| 4 | UTC storage, Asia/Saigon display | 3–7 | Config + frontend |
| 5 | No past start_at | 3 (FR-04) | Validation |
| 6 | Check-in window ±15min, auto-cancel | 5 (FR-10) | Background job, APScheduler |

---

## Các Câu Hỏi Mở (Chờ xác nhận)

1. **Capacity "soft" vs "hard":** Assumption 2 giả định capacity là hard limit. Nhưng có thường hợp user muốn booking vào phòng "vừa vặn" (18 người trong phòng 15 chỗ) không? → **Hiện tại:** hard limit. Nếu cần thay đổi, viết ADR mới.

2. **Auto-cancel notification:** Khi booking bị hủy tự động, thông báo gửi cho ai? User? Manager? → **Hiện tại:** user (via email/Slack, tuần 5). Manager có báo cáo riêng (tuần 8).

3. **Maintenance duration:** Phòng MAINTENANCE bao lâu? Có ngày / giờ kết thúc? → **Mở.** Có thể thêm `maintenance_until` field nếu cần schedule.

4. **Check-in method:** User check-in bằng API? QR code? Voice? → **Hiện tại:** API. Frontend tuần 7.

---

**Người viết:** Hùng (với sự hỗ trợ của Claude)  
**Ngày:** 2026-10-09
