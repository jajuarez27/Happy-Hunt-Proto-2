#!/usr/bin/env bash
# Happy Hunt API smoke tests.
# Usage: BASE_URL=http://localhost:3000 USER_ID=<uuid> RESTAURANT_ID=<uuid> ./tests/smoke.sh
set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"
USER_ID="${USER_ID:-11111111-1111-4111-8111-111111111104}"
RESTAURANT_ID="${RESTAURANT_ID:-22222222-2222-4222-8222-222222222201}"
FAILED=0

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo "PASS  $name (HTTP $actual)"
  else
    echo "FAIL  $name (expected $expected, got $actual)"
    FAILED=1
  fi
}

body() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "== Happy Hunt smoke tests against $BASE_URL =="

# 1. GET /health
check "GET /health" "200" "$(body "$BASE_URL/health")"

# 2. GET /api/restaurants
check "GET /api/restaurants" "200" "$(body "$BASE_URL/api/restaurants")"

# 3. GET /api/restaurants/:id (valid)
check "GET /api/restaurants/:id" "200" "$(body "$BASE_URL/api/restaurants/$RESTAURANT_ID")"

# 4. GET /api/restaurants/:id (missing -> 404)
check "GET /api/restaurants/:id 404" "404" \
  "$(body "$BASE_URL/api/restaurants/00000000-0000-4000-8000-000000000000")"

# 5. GET /api/restaurants/:id (bad uuid -> 400)
check "GET /api/restaurants/:id 400" "400" "$(body "$BASE_URL/api/restaurants/not-a-uuid")"

# 6. GET /api/saved-places?user_id=
check "GET /api/saved-places" "200" \
  "$(body "$BASE_URL/api/saved-places?user_id=$USER_ID")"

# 7. POST /api/saved-places (valid -> 201, or 409 if already saved on rerun)
code="$(body -X POST "$BASE_URL/api/saved-places" \
  -H 'Content-Type: application/json' \
  -d "{\"user_id\":\"$USER_ID\",\"restaurant_id\":\"$RESTAURANT_ID\"}")"
if [ "$code" = "201" ] || [ "$code" = "409" ]; then
  echo "PASS  POST /api/saved-places ($code)"
else
  echo "FAIL  POST /api/saved-places (expected 201 or 409, got $code)"
  FAILED=1
fi

# 8. POST /api/saved-places (missing fields -> 400)
check "POST /api/saved-places 400" "400" \
  "$(body -X POST "$BASE_URL/api/saved-places" -H 'Content-Type: application/json' -d '{}')"

# 9. POST /api/saved-places (nonexistent restaurant -> 404)
check "POST /api/saved-places 404" "404" \
  "$(body -X POST "$BASE_URL/api/saved-places" -H 'Content-Type: application/json' \
    -d "{\"user_id\":\"$USER_ID\",\"restaurant_id\":\"00000000-0000-4000-8000-000000000000\"}")"

# 10. POST /api/auth/register (new user -> 201, dup -> 409)
TS=$(date +%s)
EMAIL="smoke$TS@example.com"
reg_code="$(body -X POST "$BASE_URL/api/auth/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Smoke Test\",\"email\":\"$EMAIL\",\"password\":\"password123\"}")"
check "POST /api/auth/register" "201" "$reg_code"
check "POST /api/auth/register dup" "409" \
  "$(body -X POST "$BASE_URL/api/auth/register" -H 'Content-Type: application/json' \
    -d "{\"name\":\"Smoke Test\",\"email\":\"$EMAIL\",\"password\":\"password123\"}")"

# 11. POST /api/auth/signin (valid -> 200, bad password -> 401)
check "POST /api/auth/signin" "200" \
  "$(body -X POST "$BASE_URL/api/auth/signin" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"password123\"}")"
check "POST /api/auth/signin 401" "401" \
  "$(body -X POST "$BASE_URL/api/auth/signin" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"wrongpass\"}")"

# 12. POST /api/deals (valid -> 201)
check "POST /api/deals" "201" \
  "$(body -X POST "$BASE_URL/api/deals" -H 'Content-Type: application/json' \
    -d "{\"restaurant_id\":\"$RESTAURANT_ID\",\"day_of_week\":\"Sunday\",\"start_time\":\"11:00\",\"end_time\":\"13:00\",\"source_url\":\"https://example.com/hh\",\"deal_name\":\"Smoke Deal\",\"deal_type\":\"food\",\"regular_price\":10,\"happy_hour_price\":6}")"

# 13. POST /api/deals (end before start -> 400)
check "POST /api/deals 400" "400" \
  "$(body -X POST "$BASE_URL/api/deals" -H 'Content-Type: application/json' \
    -d "{\"restaurant_id\":\"$RESTAURANT_ID\",\"day_of_week\":\"Sunday\",\"start_time\":\"18:00\",\"end_time\":\"17:00\",\"deal_name\":\"Bad\",\"deal_type\":\"drink\",\"regular_price\":10,\"happy_hour_price\":6}")"

# 14. DELETE /api/saved-places/:id (delete the row created in step 7 -> 200)
SP_ID=$(curl -s "$BASE_URL/api/saved-places?user_id=$USER_ID" \
  | grep -o '"saved_place_id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$SP_ID" ]; then
  check "DELETE /api/saved-places/:id" "200" \
    "$(body -X DELETE "$BASE_URL/api/saved-places/$SP_ID?user_id=$USER_ID")"
else
  echo "FAIL  DELETE /api/saved-places/:id (no saved place found)"
  FAILED=1
fi

echo "----------------------------------------"
if [ "$FAILED" -eq 0 ]; then
  echo "All smoke tests passed."
else
  echo "Some smoke tests FAILED."
fi
exit "$FAILED"
