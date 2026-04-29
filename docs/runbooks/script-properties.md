# Apps Script Properties 운영 룬북

## 개요

review-mvp 의 Apps Script(`apps-script/ReviewFlow.gs`)는 다음 시크릿/설정을 **Script Properties** 에서 읽는다. **코드에 fallback 을 두지 않는다.** 누락되면 `verifyGoogleIdToken_` 등이 즉시 에러를 반환한다.

## 필수 키

| 키 | 용도 | 예시 |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Google ID Token 의 audience(aud) 검증 | `<projectNumber>-<hash>.apps.googleusercontent.com` |
| `ALLOWED_HD` | 허용 도메인 (선택, 기본값 `makestar.com`) | `makestar.com` |

## 등록/수정 절차

1. Apps Script 편집기 열기 (해당 프로젝트)
2. 좌측 톱니바퀴 ⚙ → **프로젝트 설정**
3. 하단 **스크립트 속성** 섹션 → **스크립트 속성 추가**
4. 키/값 입력 → **스크립트 속성 저장**
5. 저장 후 별도 재배포 불필요. 다음 doPost 호출부터 적용됨.

## "GOOGLE_CLIENT_ID 가 Script Properties 에 없습니다" 에러가 나오는 경우

**증상**: 로그인 시 `서버 설정 오류: GOOGLE_CLIENT_ID 가 Script Properties 에 없습니다.` 메시지

**원인 후보 (확인 순서)**
1. **속성이 등록되지 않은 새 프로젝트** → 위 절차로 등록.
2. **다른 Apps Script 프로젝트로 배포 URL 이 바뀐 경우** → 새 프로젝트에 속성을 다시 등록해야 함.
3. **속성이 정말 사라진 경우** → 키 오타 / 빈 문자열 등 확인. 정상 환경에서는 재배포로 사라지지 않음.

**❌ 하지 말 것**: 코드에 fallback 값을 박기 (예: `var GOOGLE_CLIENT_ID_DEFAULT_ = '...'`)
- git history 에 시크릿이 영구 노출됨
- `scripts/check-secrets.sh` pre-commit 훅이 차단함
- 정말 노출된 경우 OAuth Client 를 rotate 해야 함

## OAuth Client ID 가 노출됐을 때 (rotate 절차)

1. [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials) 진입
2. 노출된 OAuth 2.0 Client ID 옆 **휴지통 또는 새 Client ID 생성**
3. 새 Client ID 를 다음 두 곳에 동시에 반영:
   - Apps Script Properties: `GOOGLE_CLIENT_ID`
   - 프론트엔드 빌드: `VITE_GOOGLE_CLIENT_ID` (`.env` / Vercel env)
4. 기존 ID 가 박힌 git history 는 그대로 두되, 노출된 ID 는 더 이상 유효하지 않음을 확인 (Console 에서 삭제 후 토큰 검증 실패하는지 테스트).

## 관련

- pre-commit 훅: `scripts/check-secrets.sh` — Google Client ID, AWS key, Slack token, private key 패턴을 차단
- 코드 위치: `apps-script/ReviewFlow.gs` `verifyGoogleIdToken_()`
