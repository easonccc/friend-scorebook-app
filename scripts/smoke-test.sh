#!/usr/bin/env bash
# friend-scorebook 后端接口冒烟测试
#
# 用法：
#   bash scripts/smoke-test.sh                                   # 仅健康检查 + 未授权拦截（无需登录）
#   bash scripts/smoke-test.sh http://localhost:8080 <TOKEN>     # 追加带鉴权的只读校验
#   bash scripts/smoke-test.sh http://localhost:8080 <TOKEN> <SPACE_ID>  # 再追加比赛记录列表校验
#
# 说明：
#   - 鉴权拦截（401）不依赖登录，随时可跑。
#   - 登录需要真实微信 code（沙箱/CI 无法获取），故「带鉴权」部分需你在本机用真实账号
#     登录后，从开发者工具 Network 里复制 Authorization 的 Bearer token 传入第二个参数。
#   - 脚本按 /api/user/info 返回的 role 自动判定：admin 访问 /api/user/list 期望 200，
#     非 admin 期望 403。
set -u

BASE="${1:-http://localhost:8080}"
TOKEN="${2:-}"
SPACE_ID="${3:-}"
NP=(--noproxy '*')
PASS=0
FAIL=0

green() { printf '  \033[32m✅ %s\033[0m -> %s\n' "$1" "$2"; }
red()   { printf '  \033[31m❌ %s\033[0m -> 期望 %s 实际 %s\n' "$1" "$2" "$3"; }

expect() {
  local name="$1" want="$2" got="$3"
  if [ "$want" = "$got" ]; then green "$name" "$got"; PASS=$((PASS + 1));
  else red "$name" "$want" "$got"; FAIL=$((FAIL + 1)); fi
}

# 取 HTTP 状态码
code() { curl -s "${NP[@]}" -o /dev/null -w "%{http_code}" "$@"; }

echo "== 基础健康 =="
expect "GET /health" 200 "$(code "$BASE/health")"

echo "== 未授权拦截（无 token 应 401）=="
expect "GET /api/user/info"   401 "$(code "$BASE/api/user/info")"
expect "GET /api/user/list"   401 "$(code "$BASE/api/user/list")"
expect "GET /api/space/list"  401 "$(code "$BASE/api/space/list")"
expect "GET /api/match/list"  401 "$(code "$BASE/api/match/list")"
expect "GET /api/settings"    401 "$(code "$BASE/api/settings")"
expect "PUT  /api/user/profile" 401 "$(code -X PUT -H 'content-type: application/json' -d '{}' "$BASE/api/user/profile")"
expect "POST /api/space/create" 401 "$(code -X POST -H 'content-type: application/json' -d '{}' "$BASE/api/space/create")"

if [ -n "$TOKEN" ]; then
  echo "== 带鉴权（只读）=="
  info_body=$(curl -s "${NP[@]}" -H "Authorization: Bearer $TOKEN" "$BASE/api/user/info")
  role=$(printf '%s' "$info_body" | grep -o '"role":"[^"]*"' | head -1 | sed 's/"role":"//; s/"$//')

  expect "GET /api/user/info (auth)" 200 "$(code -H "Authorization: Bearer $TOKEN" "$BASE/api/user/info")"

  if [ "$role" = "admin" ]; then
    expect "GET /api/user/list (admin)" 200 "$(code -H "Authorization: Bearer $TOKEN" "$BASE/api/user/list")"
  else
    expect "GET /api/user/list (non-admin)" 403 "$(code -H "Authorization: Bearer $TOKEN" "$BASE/api/user/list")"
  fi

  expect "POST /api/user/members (auth)" 200 "$(code -X POST -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"openids":[]}' "$BASE/api/user/members")"
  expect "GET  /api/space/list (auth)"   200 "$(code -H "Authorization: Bearer $TOKEN" "$BASE/api/space/list")"
  expect "GET  /api/settings (auth)"     200 "$(code -H "Authorization: Bearer $TOKEN" "$BASE/api/settings")"

  if [ -n "$SPACE_ID" ]; then
    expect "GET /api/match/list (auth)" 200 "$(code -H "Authorization: Bearer $TOKEN" "$BASE/api/match/list?spaceId=$SPACE_ID")"
  fi
fi

echo ""
echo "结果: $PASS 通过, $FAIL 失败"
[ "$FAIL" -eq 0 ]
