#!/usr/bin/env bash
# Pre-commit secret scanner.
# 스테이징된 변경에서 하드코딩된 시크릿 패턴을 찾으면 커밋을 차단한다.
# 추가/삭제 라인 모두 검사 (이미 커밋된 패턴이 다시 등장해도 차단).
#
# 패턴 추가 시 false positive 를 줄이기 위해 ALLOWLIST 에 화이트리스트 토큰을 둔다.

set -e

# 검사 대상 패턴 (확장자 무관, 라인 단위)
PATTERNS=(
  # Google OAuth Client ID (12자리 프로젝트 번호 + 32자 + .apps.googleusercontent.com)
  '[0-9]{10,}-[a-z0-9]{20,}\.apps\.googleusercontent\.com'
  # Google API Key (AIza + 35자)
  'AIza[0-9A-Za-z_-]{35}'
  # AWS Access Key ID
  'AKIA[0-9A-Z]{16}'
  # Generic Bearer token / JWT (긴 base64url 3-segment)
  # Slack token
  'xox[baprs]-[0-9A-Za-z-]{10,}'
  # Private key block
  '-----BEGIN (RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----'
)

# false positive 방어: 아래 문자열이 같은 라인에 있으면 통과
ALLOWLIST_REGEX='example|EXAMPLE|placeholder|PLACEHOLDER|<.*>'

STAGED=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$STAGED" ] && exit 0

VIOLATIONS=0
for pattern in "${PATTERNS[@]}"; do
  # 스테이징된 hunk 의 추가 라인만 본다 (^+ 로 시작, 단 +++ 헤더 제외)
  matches=$(git diff --cached --no-color -U0 -- $STAGED \
    | grep -E '^\+[^+]' \
    | grep -E -e "$pattern" \
    | grep -Ev "$ALLOWLIST_REGEX" || true)
  if [ -n "$matches" ]; then
    echo "✗ 시크릿 패턴 감지: $pattern"
    echo "$matches" | sed 's/^/    /'
    echo ""
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
done

if [ "$VIOLATIONS" -gt 0 ]; then
  echo "──────────────────────────────────────────────────────────────"
  echo "커밋이 차단되었습니다. 시크릿이 감지되었습니다 ($VIOLATIONS 패턴)."
  echo ""
  echo "올바른 처리:"
  echo "  1) 시크릿을 코드에서 제거"
  echo "  2) Apps Script: Script Properties 에 등록"
  echo "  3) Vercel/로컬: 환경변수(.env, Vercel dashboard) 로 이동"
  echo ""
  echo "오탐인 경우(예: 문서/예시 코드):"
  echo "  - 같은 라인에 'example' 또는 'placeholder' 표시"
  echo "  - 또는 git commit --no-verify (정말 필요한 경우만, 사유를 PR 에 명시)"
  echo "──────────────────────────────────────────────────────────────"
  exit 1
fi

exit 0
