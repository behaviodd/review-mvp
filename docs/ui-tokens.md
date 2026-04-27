# UI Tokens (Phase 3.3c-1)

디자인 리스킨 대비 · 일관성을 위한 토큰 매트릭스. 새로 만드는 컴포넌트는 이 범위 안에서만 스타일링합니다.

## 1. 색 · Tone

| Tone     | 배경            | 전경(텍스트/아이콘) | 보더               | 쓰임                     |
|----------|-----------------|---------------------|--------------------|--------------------------|
| neutral  | `bg-gray-005`   | `text-gray-070`     | `border-gray-010`  | 기본 · 회색 배지         |
| brand    | `bg-pink-005`   | `text-pink-060`     | `border-pink-010`  | 주요 액션 · 브랜드 강조  |
| info     | `bg-blue-005`   | `text-blue-070`     | `border-blue-020`  | 정보 · 예약·공지         |
| success  | `bg-green-005`  | `text-green-070`    | `border-green-020` | 완료 · OK                |
| warning  | `bg-orange-005` | `text-orange-070`   | `border-orange-020`| 경고 · 마감 임박         |
| danger   | `bg-red-005`    | `text-red-070`      | `border-red-020`   | 파괴적 · 실패 · 지연     |
| purple   | `bg-purple-005` | `text-purple-060`   | `border-purple-010`| 자동화 · 특수 유형       |

- 팔레트 외 임의 HEX 금지.
- 텍스트 단계: `text-gray-099 / 080 / 070 / 050 / 040` 5단.
- 보더 기본: `border-gray-010`. 카드 그림자: `shadow-card`.

## 2. 타이포그래피

| Role       | Tailwind                                            |
|------------|-----------------------------------------------------|
| Page title | `text-xl font-bold text-gray-099 tracking-[-0.3px]` |
| Section h3 | `text-sm font-semibold text-gray-080`               |
| Body       | `text-sm text-gray-080`                             |
| Small      | `text-xs text-gray-050`                             |
| Caption    | `text-[11px] text-gray-040`                         |

## 3. 간격

| 용도              | 값                                       |
|-------------------|------------------------------------------|
| 카드 내부 padding | `p-4`                                    |
| 섹션 사이 gap     | `space-y-4` / `space-y-5` (페이지 레벨)  |
| 칼럼/행 gap       | `gap-2` / `gap-3`                        |
| 모달 padding      | `px-5 py-4`                              |

## 4. Elevation

- `shadow-card` — 카드 · 목록 컨테이너
- `shadow-card-hover` — 카드 hover
- `shadow-raised` — 팝오버
- `shadow-modal` — 모달 · 드로어
- `shadow-overlay` — 토스트

## 5. 버튼 (MsButton)

| Size | h      | padding     | font size   | gap       |
|------|--------|-------------|-------------|-----------|
| sm   | `h-6`  | `px-[8px]`  | `text-xs`   | `gap-0.5` |
| md   | `h-8`  | `px-[8px]`  | `text-sm`   | `gap-1`   |
| lg   | `h-10` | `px-[10px]` | `text-base` | `gap-1.5` |
| xl   | `h-12` | `px-3`      | `text-base` | `gap-2`   |
| xxl  | `h-14` | `px-4`      | `text-lg`   | `gap-2`   |

- 주요 CTA 1개만 `brand1`, 보조는 `outline-default` / `ghost`.
- 위험: `red` (채움) / `outline-red` (외곽).

## 6. 배지 — Pill

| Size | h    | padding  | font size     |
|------|------|----------|---------------|
| xs   | `h-5`| `px-1.5` | `text-[10px]` |
| sm   | `h-6`| `px-2`   | `text-[11px]` |
| md   | `h-7`| `px-2.5` | `text-xs`     |

- Pill에 아이콘 포함 시 `leftIcon` prop 사용.
- 인라인 `<span className="bg-*-005">` 직접 작성 금지 → 항상 Pill.

## 7. 컴포넌트 Catalog

| Component      | 용도                                   | 주의                                 |
|----------------|----------------------------------------|--------------------------------------|
| `ModalShell`   | 작업 단위 모달                         | 한 번에 1개만. ESC·Backdrop 닫힘     |
| `SideDrawer`   | 열어둔 채 탐색 단위                    | `lockBackdrop`으로 위험 작업 격리    |
| `ConfirmDialog`| 네이티브 `confirm()` 대체              | danger tone 시 빨간 CTA              |
| `SectionCard`  | 설정/폼 섹션                           | title/description/actions 슬롯       |
| `Pill`         | 상태·유형·카테고리 배지                | tone 7종 · size 3종                  |
| `EmptyState`   | 목록 비었을 때                         | `variant="inline"` 으로 목록 내 삽입 |
| `Field`        | 폼 필드 공통 쉘                        | required · hint · error 표시 표준    |
| `StatusBadge`  | submission/review/role 상태            | Pill 기반                            |
| `ListToolbar`  | 리스트 페이지 상단 필터/검색 툴바      | tabs · segments · search · rightSlot |

### 7.1 ListToolbar 사용 규칙

리스트 페이지(MyReviewList, TeamReviewList, PeerApprovalPage, CycleList, ReceivedReviewList, CycleArchive 등)는 **반드시** `ListToolbar` 를 사용해 필터/검색을 구성합니다.

| 슬롯       | 시각                                            | 쓰임                                      |
|------------|-------------------------------------------------|-------------------------------------------|
| `tabs`     | `border-b` + bold + count chip (선택 시 black)  | **1차 분류**. 페이지에 1세트만.           |
| `segments` | pills (≤4 옵션) / select (옵션 多 또는 라벨 길음) | **2차 분류**. 0~여러 개.                  |
| `search`   | 우측 정렬, `width='sm'`(56) / `'md'`(80)        | 단일 검색 입력. 페이지에 1개만.           |
| `rightSlot`| 임의                                            | 보조 액션(초기화 등). primary는 PageHeader |

**규칙**
- 1차 분류는 항상 tabs. CycleList처럼 카운트가 없는 경우만 segments[pills] 로 대체.
- segments 의 pill `count` 필드는 옵션 우측에 작은 숫자로 표시 (선택적).
- search 단독 사용 시 `width='md'` 권장.
- primary action(예: '새 리뷰')은 `useSetPageHeader(title, actions)` 의 `actions` 슬롯, 절대 ListToolbar `rightSlot` 에 넣지 말 것.

**금지**
- ❌ ListToolbar 우회한 인라인 `<button className="border-b ...">` 탭
- ❌ 페이지마다 다른 색·간격으로 자체 필터 바 구성

### 7.2 EmptyState 사용 규칙

| 상황 | prop                  | 사용 컨벤션                                     |
|------|-----------------------|------------------------------------------------|
| 페이지 자체 빈 (데이터 0) / 필터 결과 0 | `icon`         | 아이콘 1개 + 짧은 안내 + 보조 action            |
| 라우트 dead-end / 권한 없음 / 오류 | `illustration` | 일러스트 + 명확한 복귀 CTA                      |

**illustration variant**

| variant       | 쓰임                                  |
|---------------|---------------------------------------|
| `empty-list`  | 일반 목록 없음 / 잘못된 경로 / 권한 없음 |
| `empty-inbox` | 작성·수신 데이터 없음 (제출물·메일함류) |
| `empty-cycle` | 사이클 자체가 없거나 찾을 수 없음        |

**variant prop**
- 기본 `default` — 페이지 가운데 배치 (큰 패딩)
- `inline` — 점선 박스, 리스트/카드 내부 자리 채움용

**금지**
- ❌ `<div className="text-center py-20 text-gray-040">데이터 없음</div>` 같은 임시 placeholder
- ❌ illustration + icon 동시 지정 (illustration 우선이지만 시각적 혼란)

## 8. 아이콘

- 기본 사이즈: `size={14}` (리스트/배지), `size={16}` (버튼), `size={20}` (헤더/강조).
- 반드시 `aria-label` 또는 주변 텍스트로 컨텍스트 제공.

## 9. 반응형

- 기본 breakpoint: `md` (768px). 모바일 우선 설계.
- 리스트는 `md:grid + style={{ gridTemplateColumns }}`로 CSS 변수 기반. Tailwind JIT-safe.

## 10. 금지 목록

- ❌ `confirm()` · `alert()` · `prompt()` 네이티브 다이얼로그 → `ConfirmDialog`
- ❌ 인라인 HEX 색
- ❌ 임의 Tailwind 색(`bg-yellow-*`, `bg-teal-*` 등 토큰 외)
- ❌ Tailwind 동적 클래스 문자열 조립 (`'grid-cols-[' + n + ']'`) — JIT가 놓침
- ❌ 페이지 본문 상단의 커스텀 `<h1>` → `useSetPageHeader`
