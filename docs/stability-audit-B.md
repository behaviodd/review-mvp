# 안정성 Audit — B 그룹: 데이터 정합성 (Sheets DB)

> **상태**: 1차 정독 완료 · 매트릭스 초안 · 수정 PR 미착수
> **작성일**: 2026-04-29
> **범위**: `apps-script/ReviewFlow.gs` (1,146줄), `src/utils/sheetWriter.ts`, `src/utils/reviewSheetWriter.ts`, `src/hooks/useOrgSync.ts`, `src/hooks/useReviewSync.ts`, `api/org-sync.ts`, `api/review-sync.ts`, `src/stores/sheetsSyncStore.ts`
> **선행 audit**: A 그룹 (handoff-2026-04-28.md § 2-3)

---

## 1. 요약 (1줄 결론)

**현재 시스템은 단일 사용자·낮은 동시성 환경에서 동작하지만, `LockService` 부재 + `last-write-wins` 패턴 + multi-step 쓰기의 partial-state 가시성 부족으로, 운영자 2인 이상 동시 편집·승인 시 데이터 손실/orphan 가 재현 가능한 상태**.

내부 시연 단계에선 사용자 1~2명 환경이라 잠재 위험이 잠복하지만, 외부 시연 또는 운영팀 다인 사용 시작 전에는 P0 수정 필수.

---

## 2. Invariant 매트릭스 (12개 항목)

> **컬럼**: ID · 영역 · 의도된 invariant · 현재 보장 · 위반 시나리오 · 우선순위
> **우선순위**: P0(외부 시연 차단) / P1(운영 시작 전) / P2(개선)

| ID | 영역 | 의도된 invariant | 현재 보장 | 위반 시나리오 | 우선순위 |
|---|---|---|---|---|---|
| **B1** | Apps Script doPost 동시성 | 동시 doPost 실행이 시트 정합성을 깨지 않음 | ✅ **B-1.1 적용됨** — `withLock_` 으로 doPost 직렬화. tryLock 15s, 실패 시 `{error:'lock_busy'}` | (해소) | ~~P0~~ |
| **B2** | upsertRow / patchRow 의 동시성 | row 수정 시 다른 사용자의 동시 수정을 손실하지 않음 (CAS or merge) | ✅ **B-1.1 으로 race window 제거** — last-write-wins 패턴은 그대로지만 두 write 가 직렬 실행이라 inter-write race 없음. 단 user 의 정밀 merge (예: A 가 직책, B 가 이메일 동시 수정) 는 여전히 한쪽이 다른 쪽을 덮음 — 이는 UI 흐름 문제 (아래 잔여 항목 참조) | 동일 row 의 다른 필드 동시 수정 시 한쪽 변경 손실 가능 — UI 측 stale-form 가드 필요 | **P1** (잔여) |
| **B3** | `approveMember` 의 4단계 트랜잭션 | 4단계(구성원/권한그룹/대기승인/감사로그)가 모두 반영되거나 모두 안 반영 (atomicity) | ✅ **B-1.1 + B-1.2 적용됨** — lock 안에서 4단계 직렬 실행. 1단계 idempotent 화 (이메일 일치 시 retry 안전). 응답에 `steps` 필드로 단계별 status. 4단계 audit 의 retry 중복은 B-2.4 에서 처리 | (대부분 해소, audit 중복만 잔여) | ~~P0~~ → P1 |
| **B4** | `_권한그룹.멤버사번JSON` read-modify-write | 동시 두 운영자의 멤버 추가가 둘 다 반영됨 | ✅ **B-1.1 으로 race window 제거** — read-modify-write 가 lock 안에서 직렬 실행 | (해소) | ~~P0~~ |
| **B5** | `batchUpsertUsers` / `batchUpsertOrgUnits` 부분 실패 | row N개 upsert 가 모두 성공하거나 client 가 어디까지 반영됐는지 알 수 있음 | ✅ **B-2.1 적용됨** — row 별 try-catch + `{ok, count, total, failed[]}` 응답. client 의 `postPayload` 가 `failed.length>0` 시 명시 throw → 사용자 가시화. 멱등 액션이라 resilientFetch 가 자동 1회 retry | (해소) | ~~P1~~ |
| **B6** | `deleteCycle` 의 cascade 정합성 | cycle row 삭제 시 모든 submissions 도 함께 삭제 (또는 둘 다 안 됨) | ✅ **B-2.2 적용됨** — submissions 먼저 삭제 → cycle 마지막. 부분 실패 시 cycle 보존되어 retry 시 idempotent 하게 나머지 처리 가능. 응답에 `deletedSubmissions` count | (해소, 단 6분 한계 시 청크 분할은 F 그룹과 연결) | ~~P1~~ |
| **B7** | `markWrite` grace 4s 의 stale-overwrite 보호 | 자기 쓰기 직후 polling 이 stale 시트로 optimistic 상태를 덮어쓰지 않음 | ⚠️ **본인 grace 만 보호** — `lastWriteAt` 은 in-memory + 단일 탭 격리. 다른 탭/사용자의 쓰기는 grace 없음 | 다중 탭 시연 시: 탭 A 쓰기 → 탭 B 의 polling 은 grace 모름 → 탭 B 의 optimistic 상태 덮임 (현재 시연에선 빈도 낮음) | **P2** |
| **B8** | 인사스냅샷 immutability | createSnapshot 이후 payloadJSON 변조 불가 (시점 일관성) | ✅ **append-only** — `upsertSnapshot` 액션 없음, `createSnapshot` 만 존재. 클라이언트는 변조 불가 | 단, **운영자가 시트 직접 편집 시** 변조 가능. 시트 권한/감사로그로만 보장 | **P2** |
| **B9** | redirect:'manual' POST 처리 | 302 location 추출 + 실제 doPost 호출 보장 | ✅ **B-2.3 적용됨** — 첫·둘째 fetch 별도 AbortController + 전체 budget 18s 동적 분배. `location` null 시 502 명시 에러. 잔여 budget < 1s 면 즉시 504 | (해소) | ~~P1~~ |
| **B10** | `audit.append` 큐 중복 방지 | 같은 감사 이벤트는 한 번만 시트에 기록됨 | ❌ **op id = entry.id** 인데 entry.id 는 호출마다 새로 생성 → dedupe 안 됨. 사용자 재시도 시 중복 적재 가능 | 사용자가 "재시도" 버튼 빠르게 두 번 누르면 동일 이벤트가 큐에 2개 → 시트에 두 번 기록 (감사로그 변조 효과) | **P1** |
| **B11** | `_계정` 시트 deprecated 정책 | R7 이후 `_계정` 시트 동기화 중단 | ❌ **여전히 동기화 중** — `createUser`/`syncAccounts`/`initAccount` 가 `_계정` 시트에 upsert. cleanup 누락 | 운영자가 deprecated 시트 보고 권한 인덱스로 오해할 가능성. 정합성 위험은 낮으나 코드 부채 | **P2** |
| **B12** | `_invalidateBulkCache_` 정합성 | 쓰기 액션 후 다음 GET 이 fresh 시트 데이터를 반환 | ✅ **사실상 자동 보장** — `BULK_CACHE_ENABLED_ = false` 라 모든 쓰기는 자동으로 fresh. `_invalidate*` 는 no-op | 캐시 재활성화 시 invalidate 누락된 액션 발견 가능성. 현재는 위험 없음 | **P2** |

---

## 3. Race Window 표 (Concurrency Primitive 별)

| Primitive | 현재 사용 | 갭 |
|---|---|---|
| **`LockService.getScriptLock()`** | 0건 | doPost 전체 또는 시트별 lock 필요 (B1, B3, B4) |
| **CAS / 버전 컬럼** | 없음 | row 의 `_version` 또는 `lastUpdatedAt` 비교 (B2) |
| **클라이언트 grace (`lastWriteAt`)** | in-memory, 단일 탭 | 다중 탭 시 BroadcastChannel 또는 localStorage 이벤트로 공유 (B7) |
| **op id dedupe** | upsert/delete 만 (`kind:targetId`) | append 류 (B10) 도 idempotency key 도입 필요 |
| **트랜잭션 wrapper** | 없음 | multi-step write 를 단일 transaction id 로 묶고 partial state 시 rollback 또는 명시적 partial result 반환 (B3, B5, B6) |

---

## 4. 동시성 시나리오 매트릭스 (재현 가능한 위반 케이스)

| # | 시나리오 | 빈도 (시연 단계) | 빈도 (다인 운영) | 데이터 영향 |
|---|---|---|---|---|
| S1 | 운영자 2인이 동시에 같은 사용자 정보 수정 | 거의 없음 | 보통 | 한 명의 변경 손실 |
| S2 | 운영자 2인이 동시에 다른 사용자를 같은 권한그룹에 승인 | 없음 | 낮음 (특정 시점 몰림 시) | 한 명의 멤버 추가 손실 |
| S3 | 사이클 삭제 중 Apps Script 6분 timeout | 없음 (수십 submissions 일 때) | 낮음 (수백+ submissions 일 때) | submission orphan |
| S4 | 다중 탭에서 한 탭이 쓰기, 다른 탭이 polling | 가능 (1인 다탭) | 보통 | 다른 탭의 optimistic 상태 덮임 |
| S5 | 사용자가 "재시도" 빠르게 두 번 누름 | 가능 | 가능 | audit 중복 적재 |
| S6 | Apps Script cold start + POST redirect chain | 보통 (Vercel 배포 직후) | 보통 | timeout 빈도 증가 (B9) |
| S7 | 동시 batchUpsert 도중 한 row 의 데이터 검증 실패 | 없음 (시트는 검증 안 함) | 낮음 | partial state 가시화 부재 |
| S8 | 운영자가 시트 직접 편집 + 동시에 앱 쓰기 | 가능 | 가능 | header/row index 어긋남 가능 |

---

## 5. 수정 PR 우선순위 (제안)

### Phase B-1 (P0, 외부 시연 차단) — Apps Script LockService + atomicity

**B-1.1**: `apps-script/ReviewFlow.gs` 의 모든 `doPost` 진입점을 `withLock_(fn)` 으로 감싸기
- `LockService.getScriptLock()` + `tryLock(15_000ms)` (Vercel Edge 18s timeout 보다 충분히 짧게)
- lock 획득 실패 시 명시적 에러 (`{error: 'lock_busy', retryAfterMs: ...}`) → 클라이언트가 retry 가능
- 트레이드오프: 모든 쓰기 직렬화 → 처리량 감소. 그러나 Sheets DB 자체가 초당 수 건 이하라 영향 미미
- 영향: B1, B2 (last-write-wins 의 race window 자체 제거), B3·B4 (multi-step 의 inter-write race 제거)

**B-1.2**: `approveMember` 를 단일 트랜잭션 함수로 재구성
- 4단계를 하나의 `withLock_` 안에 묶고, 단계별 try-catch 로 partial 시 rollback (이미 추가된 사용자 row 삭제 등)
- 또는 더 단순한 접근: 4단계를 시트별 idempotent 로 만들고, response 에 단계별 성공 여부 반환 → 클라이언트가 보고 재실행
- 트레이드오프: rollback 은 코드 복잡, idempotent + step status 가 더 견고

### Phase B-2 (P1, 운영 시작 전) — 부분 실패 가시화 + redirect 정비

**B-2.1**: `batchUpsertUsers`/`batchUpsertOrgUnits` 의 partial result 반환
- response 에 `{ ok: false, processedCount: 2, failedAt: 3, error: ... }` 형태로 어디까지 반영됐는지 명시
- 클라이언트는 partial 응답 보고 처리됨/처리안됨 정확히 구분 → optimistic 상태 정합성 유지

**B-2.2**: `deleteCycle` 의 cascade 안전화
- 순서 변경: submissions 먼저 삭제 → cycle 마지막 삭제. submissions 삭제 도중 실패 시 cycle 은 남아있음 (orphan 위험 제거)
- 또는 batched delete + transaction wrapper

**B-2.3**: Vercel Edge POST redirect 정비 (`api/org-sync.ts`, `api/review-sync.ts`)
- 두 번째 fetch (location 따라가기) 의 timer 를 새로 설정 (지금은 첫 fetch 의 남은 시간만 사용)
- `location` null 시 명시적 에러 응답 (`{error: 'redirect_no_location'}`)

**B-2.4**: `audit.append` 의 idempotency key 도입
- entry.id 가 매 호출 새로 생성되는 게 아니라 (action, actorId, targetIds, at-rounded-to-second) 해시로 derive
- op id 도 동일 해시 사용 → 큐 dedupe 작동
- Apps Script 측에서도 같은 (logId 또는 derived key) 가 이미 있으면 skip

### Phase B-3 (P2, 개선) — 코드 부채 정리

**B-3.1**: `markWrite` 다중 탭 공유 — `BroadcastChannel('sheets-sync')` 또는 storage event
**B-3.2**: `_계정` 시트 동기화 코드 제거 (createUser/syncAccounts/initAccount 분기 정리)
**B-3.3**: `_invalidateBulkCache_` 호출 제거 (cache 비활성 상태) 또는 헬퍼 자체 삭제
**B-3.4**: 인사스냅샷 시트 — 운영자 직접 편집 변조 방지 안내 (시트 보호 권한 + 감사로그)

---

## 6. 검증 방법

각 fix 마다 다음 4종 검증 + 추가:

```bash
npm run build && npm test && npm run lint
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5174/api/org-sync?action=bulkGetAll
```

**B-1 (LockService) 검증**:
- Apps Script 편집기에서 `concurrentTest_()` 함수 작성 — `Promise.all([fetch1, fetch2])` 동시 호출 시뮬
- 시트 직접 검증: 두 운영자 시뮬로 같은 row 동시 update → 두 변경 모두 반영되는지 또는 하나가 lock 으로 거부되는지 확인

**B-2 (partial result) 검증**:
- 단위 테스트: client 측 batchUpsert 가 partial response 받으면 optimistic 상태를 어떻게 다루는지 검증
- 통합: 의도적으로 3번째 row 에 검증 실패 데이터 넣고 시트 상태 vs response 비교

**B-3 (코드 부채) 검증**:
- lint + build 통과만 확인. 동작 변경 없음.

---

## 7. 영향 범위 평가 (외부 시연 일정과의 관계)

| 항목 | 외부 시연 가능? | 운영 시작 가능? |
|---|---|---|
| B-1 미수정 (LockService 부재) | ⚠️ 단일 운영자 시연 한정 | ❌ |
| B-2 미수정 (partial state) | ⚠️ 시연에서 batch 작업 안 보여주면 OK | ❌ |
| B-3 미수정 (부채 정리) | ✅ | ✅ |
| **A-2 (TEMP SSO 우회)** | ❌ (이미 핸드오프 § 4-1 에서 명시) | ❌ |

**결론**: 외부 시연 들어가기 전에 **A-2 + B-1 (B-1.1, B-1.2)** 가 동시 필수 조건. 운영 시작 전엔 B-2 까지 권장.

---

## 8. 미해결 질문 (다음 단계 조사)

1. **Apps Script 동시 실행 정책의 실제 동작** — `Web App > Execute as` / `Who has access` 설정에 따라 동시성이 다르다는 보고가 있음. 실증 테스트 필요 (B-1 검증 시 같이)
2. **LockService 의 6분 한계와 대규모 batch 의 양립성** — `batchUpsertUsers` 가 100명+ 처리 시 lock 보유 시간이 6분 넘을 가능성. 청크 분할 패턴 검토 필요 (F 그룹 회복 가능성과 연결)
3. **시트 권한 모델** — 운영자가 시트 직접 편집할 수 있는 권한 범위 확인. 변조 방지를 위한 시트 보호 + 감사로그 정책 (E 그룹 관측성과 연결)
4. **multi-tab 사용 빈도** — 시연/운영 단계에서 운영자 1인이 여러 탭 동시 사용하는 빈도 측정 (B7 우선순위 재평가)

---

## 9. 다음 작업 흐름 (승인 시)

1. **사용자 합의** — 본 매트릭스 + 우선순위 검토 → P0 항목 합의
2. **Phase B-1.1 착수** — `withLock_` 헬퍼 + 모든 doPost 진입점 wrap
   - 검증 4종 그린 → commit `chore(stability): B 그룹 — Apps Script LockService 도입`
3. **Phase B-1.2 착수** — `approveMember` 트랜잭션 재구성
   - 단계별 idempotent + status response 패턴
   - 검증 4종 그린 → commit `chore(stability): B 그룹 — approveMember atomicity`
4. **Phase B-2.1~B-2.4 단계별 진행** (사용자 합의 후)
5. **본 문서 업데이트** — 각 Phase 완료 시 § 2 매트릭스의 "현재 보장" 컬럼 갱신

---

작성: 2026-04-29 · audit 1차 산출물. Phase B-1 착수 시 § 2 매트릭스 갱신.
