#!/usr/bin/env bash
# get-token.sh — Lấy JWT từ Auth0 để test
#
# Dùng:
#   scripts/get-token.sh m2m                  # Machine-to-Machine token
#   scripts/get-token.sh employee             # User token (role: Employee)
#   scripts/get-token.sh manager              # User token (role: Room Manager)
#   scripts/get-token.sh admin                # User token (role: Administrator)
#
# Yêu cầu: .env đã có AUTH0_DOMAIN, AUTH0_AUDIENCE, AUTH0_M2M_CLIENT_ID, AUTH0_M2M_CLIENT_SECRET
# Resource Owner Password chỉ dùng khi local/test (không bật trên Auth0 production).

set -euo pipefail

ENV_FILE="$(dirname "$0")/../.env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
fi

: "${AUTH0_DOMAIN:?Chưa set AUTH0_DOMAIN trong .env}"
: "${AUTH0_AUDIENCE:?Chưa set AUTH0_AUDIENCE trong .env}"

MODE="${1:-m2m}"

get_m2m_token() {
  : "${AUTH0_M2M_CLIENT_ID:?Chưa set AUTH0_M2M_CLIENT_ID trong .env}"
  : "${AUTH0_M2M_CLIENT_SECRET:?Chưa set AUTH0_M2M_CLIENT_SECRET trong .env}"

  curl -s --request POST \
    --url "https://${AUTH0_DOMAIN}/oauth/token" \
    --header 'content-type: application/json' \
    --data "{
      \"client_id\": \"${AUTH0_M2M_CLIENT_ID}\",
      \"client_secret\": \"${AUTH0_M2M_CLIENT_SECRET}\",
      \"audience\": \"${AUTH0_AUDIENCE}\",
      \"grant_type\": \"client_credentials\"
    }"
}

get_user_token() {
  local email="$1" password="$2"
  # Resource Owner Password Grant — chỉ bật khi local/test.
  # Cần enable "Password" grant trong Auth0 Application settings.
  : "${AUTH0_M2M_CLIENT_ID:?}"
  : "${AUTH0_M2M_CLIENT_SECRET:?}"

  curl -s --request POST \
    --url "https://${AUTH0_DOMAIN}/oauth/token" \
    --header 'content-type: application/json' \
    --data "{
      \"client_id\": \"${AUTH0_M2M_CLIENT_ID}\",
      \"client_secret\": \"${AUTH0_M2M_CLIENT_SECRET}\",
      \"audience\": \"${AUTH0_AUDIENCE}\",
      \"grant_type\": \"password\",
      \"username\": \"${email}\",
      \"password\": \"${password}\",
      \"scope\": \"openid profile email\"
    }"
}

case "$MODE" in
  m2m)
    echo "=== M2M Token ===" >&2
    get_m2m_token
    ;;
  employee)
    echo "=== Employee Token ===" >&2
    get_user_token "employee@test.mrms" "Test@12345"
    ;;
  manager)
    echo "=== Room Manager Token ===" >&2
    get_user_token "manager@test.mrms" "Test@12345"
    ;;
  admin)
    echo "=== Administrator Token ===" >&2
    get_user_token "admin@test.mrms" "Test@12345"
    ;;
  *)
    echo "Usage: $0 [m2m|employee|manager|admin]" >&2
    exit 1
    ;;
esac

echo ""
echo "Decode tại: https://jwt.io" >&2
