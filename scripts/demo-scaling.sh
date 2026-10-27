#!/usr/bin/env bash
# demo-scaling.sh — chứng minh booking-service stateless với 2 instances.
#
# Cách dùng:
#   docker compose up --scale booking-service=2 -d --wait
#   ./scripts/demo-scaling.sh
#
# Kết quả mong đợi: hostname trong response thay đổi giữa các request
# (request 1 → booking-service-1, request 2 → booking-service-2, ...).

set -euo pipefail

HEALTH_URL="${NGINX_URL:-http://localhost:8080}/api/bookings/health"
N="${1:-10}"

echo "=== Gửi $N request đến $HEALTH_URL ==="
echo ""

declare -A counts
for i in $(seq 1 "$N"); do
    response=$(curl -s "$HEALTH_URL")
    hostname=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('hostname','?'))" 2>/dev/null || echo "?")
    counts["$hostname"]=$(( ${counts["$hostname"]:-0} + 1 ))
    printf "  [%2d] hostname=%s\n" "$i" "$hostname"
done

echo ""
echo "=== Tổng hợp ==="
for host in "${!counts[@]}"; do
    echo "  $host: ${counts[$host]} requests"
done

echo ""
UNIQUE=${#counts[@]}
if [ "$UNIQUE" -ge 2 ]; then
    echo "✓ Có $UNIQUE instance khác nhau xử lý request → booking-service stateless OK"
else
    echo "⚠ Chỉ thấy $UNIQUE instance. Docker DNS có thể đang cache. Chạy lại sau 1s."
fi
