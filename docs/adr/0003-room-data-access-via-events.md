# ADR-0003: Booking lấy dữ liệu Room qua Event-Driven Snapshots

- **Trạng thái:** Accepted
- **Ngày:** 2026-10-09

## Bối cảnh

ADR-0002 quy định mỗi service một database riêng, cấm cross-service JOINs hoặc foreign keys. Tuy nhiên, Booking Service cần thông tin Room (dung tích, trạng thái, trang bị) để:
- Tìm phòng trống (FR-03): query phòng có capacity ≥ yêu cầu, không có booking trùng lịch.
- Kiểm tra hợp lệ trước booking: số người ≤ dung tích, status = AVAILABLE.
- Hiển thị chi tiết phòng trong confirmation/history.

**Vấn đề:** Booking không thể `SELECT FROM rooms WHERE ...` (khác database). Cần cơ chế để Room Service chia sẻ dữ liệu với Booking mà không vi phạm database isolation.

## Các phương án

| | A. HTTP call đồng bộ | B. Event-driven snapshots |
|---|---|---|
| **Flow** | Booking call Room API: `GET /api/rooms?capacity=15` | Room publish event → Booking lưu `room_snapshots` → JOIN local |
| **Query phòng trống** | Lấy rooms từ API + loop filter bookings | 1 SQL JOIN: `room_snapshots` + `bookings` |
| **Độ trễ** | Network round-trip (~50ms) | Event queue (~100ms), khối lưu lập tức (~1ms) |
| **Nếu Room Service DOWN** | ❌ Booking fail: không lấy được danh sách rooms | ✅ Booking vẫn chạy: query snapshot cũ |
| **Consistency** | Strong: luôn data từ Room thật | Eventual: ~100ms delay; snapshot có thể cũ nếu Room down |
| **RabbitMQ reuse** | Không dùng | ✅ Dùng (task #7 sắp code) |
| **Complexity** | Thấp: 1 HTTP call | Cao hơn: pub/sub, idempotency, version tracking |

## Quyết định

Chọn **B. Event-driven snapshots.**

**Lý do:**
1. **Resilience:** Booking tiếp tục hoạt động khi Room Service down (snapshot cũ). Dự án microservices phải demonstrate loose coupling.
2. **Query performance:** JOIN local nhanh hơn round-trip HTTP + filter code.
3. **RabbitMQ reuse:** Tuần 1–5 sắp code RabbitMQ cho notification (task #7). Dùng lại để sync Room data → 1 broker, 1 bộ skill.
4. **Scalability:** RabbitMQ buffer events; Booking instances nhiều → HTTP calls lũy tiến tới Room (A nhạy cảm với beachhead). Events idempotent → retry an toàn.

## Hệ quả

### Tích cực

- **Loose coupling:** Room Service down không crash Booking.
- **Fast queries:** Booking query `room_snapshots` + `bookings` cùng database → 1 SQL JOIN, không network hop.
- **Idempotent updates:** Version tracking → event gửi nhiều lần hoặc thứ tự sai không ảnh hưởng (chỉ cập nhật nếu version tăng).
- **Transactional publishing:** Room publish event **sau** commit tới `rooms` (transactional outbox pattern, tuần 5).

### Tiêu cực / cần xử lý

1. **Eventual consistency (~100ms delay):**
   - Khi Room Service tạo phòng mới, Booking không thấy ngay (chờ event process).
   - Khi Room Service change status AVAILABLE → MAINTENANCE, Booking snapshot cũ một lát.
   - **Giải pháp:** Thêm `last_synced` timestamp vào snapshot; báo lỗi 503 nếu snapshot > 1 giờ cũ (Room Service DOWN lâu).

2. **Snapshot có thể "sai":**
   - Nếu Room Service DOWN, admin sửa capacity/status, Room khởi động lại → event deliver cũ.
   - Snapshot được cập nhật, nhưng có khoảng thời gian user đặt phòng với thông tin cũ.
   - **Giải pháp:** Initial sync từ Room API khi table trống hoặc schedule 5–10 phút 1 lần; xác nhận user "booked in offline mode" nếu snapshot quá cũ.

3. **Event loss (nếu RabbitMQ die trước consume):**
   - Nếu RabbitMQ + Room Service cùng crash, event mất.
   - **Giải pháp:** RabbitMQ `durable=True`, Booking queue `durable=True`, message persistent. Config Postgres: không phải TTL nên có thể initial sync.

### Khôi phục khi Room Service DOWN

```
Timeline:
T0: Room tạo P101 → publish event → Booking snapshot: P101 v1
T5: Room Service crash 💥 → RabbitMQ queue chờ
T10: User book P101 → query snapshot P101 v1 → kiểm tra hợp lệ → OK → booking tạo thành công
T20: Room Service restart → RabbitMQ deliver lại event → snapshot update v2 (nếu có)
```

**Booking vẫn chạy, nhưng dùng thông tin phòng hơi cũ.** Rủi ro thấp: nếu snapshot chỉ quá cũ 30–60 phút (time to restore), thường không có thay đổi capacity/status trong khoảng đó.

## Implementation Details

### 1. Room Service: Publish Event (tuần 2)

```python
# room-service/app/services/room.py
async def create_room(data: CreateRoomRequest, db: Session):
    room = Room(name=data.name, capacity=data.capacity, ...)
    db.add(room)
    db.commit()  # ← lưu DB trước
    
    # Transactional outbox (tuần 5) hoặc đơn giản publish sau commit
    await rabbitmq.publish("room.created", {
        "room_id": room.id,
        "name": room.name,
        "capacity": room.capacity,
        "status": room.status,
        "equipment": room.equipment,
        "version": 1
    })
```

### 2. Booking Service: Subscribe + Snapshot (tuần 2)

```python
# booking-service/app/models/room_snapshot.py
class RoomSnapshot(Base):
    __tablename__ = "room_snapshots"
    
    room_id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    capacity = Column(Integer, nullable=False)
    status = Column(String(50), default="AVAILABLE")
    equipment = Column(JSON, default=list)
    version = Column(Integer, default=0)  # ← idempotency
    last_synced = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

# booking-service/app/services/room_sync.py
async def on_room_event(message: dict, event_type: str):
    """Consume room.created hoặc room.updated"""
    snapshot = db.query(RoomSnapshot).filter_by(room_id=message["room_id"]).first()
    
    # Idempotency: bỏ qua event cũ
    if snapshot and snapshot.version >= message.get("version", 0):
        logger.info(f"Ignore stale event", extra={"fields": {
            "room_id": message["room_id"],
            "stored_version": snapshot.version,
            "event_version": message.get("version")
        }})
        return
    
    if snapshot:
        # Update
        snapshot.name = message["name"]
        snapshot.capacity = message["capacity"]
        snapshot.status = message["status"]
        snapshot.equipment = message.get("equipment", [])
        snapshot.version = message["version"]
    else:
        # Create
        snapshot = RoomSnapshot(
            room_id=message["room_id"],
            name=message["name"],
            capacity=message["capacity"],
            status=message["status"],
            equipment=message.get("equipment", []),
            version=message["version"]
        )
        db.add(snapshot)
    
    db.commit()
    logger.info(f"Synced room snapshot", extra={"fields": {
        "room_id": message["room_id"],
        "version": message["version"]
    }})
```

### 3. Booking: Query with JOIN (tuần 3)

```python
# booking-service/app/services/booking.py
async def find_available_rooms(
    capacity: int,
    start_at: datetime,
    end_at: datetime,
    db: Session
):
    """Tìm phòng trống, dùng snapshot + booking table"""
    return db.query(RoomSnapshot).outerjoin(
        Booking,
        and_(
            RoomSnapshot.room_id == Booking.room_id,
            Booking.start_at < end_at,
            Booking.end_at > start_at,
            Booking.status.in_(["CONFIRMED", "CHECKED_IN"])
        )
    ).filter(
        RoomSnapshot.capacity >= capacity,
        RoomSnapshot.status == "AVAILABLE",
        Booking.id.is_(None)  # ← phòng không ai đặt giờ này
    ).all()
```

### 4. Healthcheck: Room Service availability (tuần 2)

```python
# booking-service/app/api/health.py
@router.get("/health")
def health(
    response: Response,
    db_ok: bool = Depends(database_is_healthy)
) -> dict[str, str]:
    """200 nếu DB ổn; 503 nếu DB down hoặc snapshot quá cũ"""
    
    if not db_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "degraded", "database": "unavailable"}
    
    # Check snapshot freshness
    oldest = db.query(func.min(RoomSnapshot.last_synced)).scalar()
    if oldest and (utcnow() - oldest) > timedelta(hours=1):
        # Snapshot > 1 giờ cũ → Room Service probably down lâu
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "degraded", "reason": "room_snapshots_stale"}
    
    return {"status": "ok", "service": "booking", "database": "ok"}
```

### 5. Initial Sync (tuần 2–3)

```python
# booking-service/app/services/room_sync.py
async def initial_sync():
    """Gọi lần đầu khởi động hoặc schedule định kỳ"""
    if db.query(RoomSnapshot).count() > 0:
        return  # Đã có snapshot, skip
    
    try:
        rooms = await http_client.get(
            "http://room-service:8000/api/rooms",
            timeout=5
        )
        for room in rooms:
            snapshot = RoomSnapshot(
                room_id=room["id"],
                name=room["name"],
                capacity=room["capacity"],
                status=room["status"],
                equipment=room.get("equipment", []),
                version=room.get("version", 0)
            )
            db.add(snapshot)
        db.commit()
        logger.info(f"Initial sync: {len(rooms)} rooms", extra={"fields": {
            "count": len(rooms)
        }})
    except Exception as e:
        logger.warning(f"Initial sync failed", extra={"fields": {"error": str(e)}})
        # Tiếp tục chạy (event listener sẽ populate snapshot sau)
```

## Testing

1. **Unit:** Kiểm tra idempotency: event version 2 gửi 2 lần → snapshot cập nhật 1 lần.
2. **Integration:** RabbitMQ + Postgres
   - Room create P101 → Booking nhận event → snapshot có P101.
   - Room update P101 capacity 15 → 20 → snapshot cập nhật.
   - Query trống với version mới nhất.
3. **Resilience:** Dừng Room Service → Booking query snapshot cũ → booking vẫn tạo được.
4. **Conflict resolution:** Booking instance A + B cùng consume event + update snapshot → version check đảm bảo consistency.

## Câu hỏi mở / Tuần sau

- **Transactional Outbox (tuần 5):** Room publish event bằng outbox pattern (lưu `outbox` table + async poller) để đảm bảo event không mất nếu Room crashed sau `db.commit()` nhưng trước `publish()`.
- **Snapshot retention:** Giữ history snapshot (với `version` + `updated_at`)? Dùng để audit hoặc rewind nếu cần.
- **Event schema versioning:** Nếu Room service thêm field mới vào event, làm sao Booking service (version cũ) xử lý? (Tuần 8: forward compatibility check).
