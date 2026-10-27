#!/usr/bin/env python3
"""Load test cơ bản cho booking-service.

Kiểm tra:
1. Concurrent booking requests — chứng minh EXCLUDE constraint hoạt động:
   N requests cùng room/time → đúng 1×201, (N-1)×409
2. Rate limiting — gửi >20 req/s → nhận 429

Yêu cầu:
  pip install httpx
  docker compose up --scale booking-service=2 -d --wait
  export TOKEN=<valid JWT> (hoặc dùng --no-auth để bỏ qua auth)

Dùng:
  python scripts/load-test.py --base-url http://localhost:8080 --token $TOKEN
  python scripts/load-test.py --base-url http://localhost:8080 --no-auth
"""

import argparse
import asyncio
import sys
from datetime import UTC, datetime, timedelta

try:
    import httpx
except ImportError:
    print("ERROR: pip install httpx trước khi chạy script này")
    sys.exit(1)


async def _post(client: httpx.AsyncClient, url: str, payload: dict) -> int:
    try:
        r = await client.post(url, json=payload, timeout=10.0)
        return r.status_code
    except Exception as e:
        print(f"  ERROR: {e}")
        return 0


async def test_concurrent_booking(base_url: str, headers: dict, n: int = 10) -> None:
    """N concurrent requests để đặt cùng 1 phòng/cùng giờ → 1×201, (N-1)×409."""
    print(f"\n=== Test 1: {n} concurrent booking requests (cùng phòng, cùng giờ) ===")
    start = (datetime.now(UTC) + timedelta(hours=2)).replace(minute=0, second=0, microsecond=0)
    end = start + timedelta(hours=1)
    payload = {
        "room_id": 1,
        "start_at": start.isoformat(),
        "end_at": end.isoformat(),
        "num_attendees": 3,
    }
    url = f"{base_url}/api/bookings/"

    async with httpx.AsyncClient(headers=headers) as client:
        tasks = [_post(client, url, payload) for _ in range(n)]
        codes = await asyncio.gather(*tasks)

    count = {c: codes.count(c) for c in set(codes)}
    print(f"  Kết quả: {dict(sorted(count.items()))}")

    created = count.get(201, 0)
    conflict = count.get(409, 0)
    unauth = count.get(401, 0) + count.get(403, 0)

    if unauth > 0:
        print(f"  ⚠ {unauth} request bị từ chối auth (401/403). Dùng --no-auth hoặc cung cấp token hợp lệ.")
    elif created == 1 and conflict == n - 1:
        print(f"  ✓ PASS: 1×201, {n - 1}×409 — EXCLUDE constraint hoạt động đúng với {n} instance")
    elif created == 0 and conflict == n:
        print("  ✓ PASS: 0×201, (cùng time slot đã đặt trước), tất cả 409")
    else:
        print(f"  ✗ FAIL: mong đợi 1×201 + {n - 1}×409, nhận được: {count}")


async def test_rate_limiting(base_url: str, headers: dict, n: int = 60) -> None:
    """Gửi N requests liên tiếp nhanh → một số phải nhận 429."""
    print(f"\n=== Test 2: Rate limiting — gửi {n} requests nhanh (limit=20r/s burst=40) ===")
    url = f"{base_url}/api/bookings/health"

    async with httpx.AsyncClient(headers=headers) as client:
        tasks = [_post(client, url, {}) for _ in range(n)]
        # httpx GET thay vì POST cho health
        async def _get(url: str) -> int:
            try:
                r = await client.get(url, timeout=5.0)
                return r.status_code
            except Exception:
                return 0
        codes = await asyncio.gather(*[_get(url) for _ in range(n)])

    count = {c: codes.count(c) for c in set(codes)}
    print(f"  Kết quả: {dict(sorted(count.items()))}")

    ok = count.get(200, 0)
    limited = count.get(429, 0)
    if limited > 0:
        print(f"  ✓ PASS: {limited} request bị rate-limit (429) — nginx limit_req hoạt động")
    else:
        print(f"  ⚠ Không có 429. Burst={min(n,40)} có thể đủ để hấp thụ {n} request.")
        print(f"  Tất cả {ok} request nhận 200 — thử lại với --rate-requests 100")


async def main() -> None:
    parser = argparse.ArgumentParser(description="Load test for MRMS booking-service")
    parser.add_argument("--base-url", default="http://localhost:8080")
    parser.add_argument("--token", default="")
    parser.add_argument("--no-auth", action="store_true")
    parser.add_argument("--concurrent", type=int, default=10, help="concurrent booking requests")
    parser.add_argument("--rate-requests", type=int, default=60, help="requests for rate-limit test")
    args = parser.parse_args()

    headers = {}
    if not args.no_auth and args.token:
        headers["Authorization"] = f"Bearer {args.token}"

    print(f"Base URL: {args.base_url}")
    print(f"Auth: {'Bearer token' if args.token else 'none (--no-auth)'}")

    await test_concurrent_booking(args.base_url, headers, n=args.concurrent)
    await test_rate_limiting(args.base_url, headers, n=args.rate_requests)

    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
