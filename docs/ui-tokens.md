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

- ~~`shadow-card`~~ · ~~`shadow-card-hover`~~ — **deprecated (Phase D-1.4)**. 값 `none` 으로 무효화됨. 카드 류는 border 만으로 영역 구분 (Figma 정합)
- `shadow-raised` — 팝오버
- `shadow-modal` — 모달 · 드로어
- `shadow-overlay` — 토스트 · LNB 드롭다운

## 4-1. Interaction (Phase D-2.1)

| 토큰 | hex | 쓰임 |
|---|---|---|
| `bg-interaction-hovered` | `rgba(76,90,102,0.08)` | hover 효과 — semi-transparent 가 의도 (raw 색상보다 자연스러운 카스케이드) |
| `bg-interaction-pressed` | `rgba(76,90,102,0.20)` | active/pressed 효과 |

raw 팔레트 (`bg-gray-005` 같은 불투명 클래스) 대신 hover 에는 `interaction` 토큰 사용. Figma `Color/Interaction/*` 정합.

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
| `ListToolbar`  | 리스트 페이지 상단 필터/검색 툴바      | segments · search · rightSlot |
| **`Sidebar` (LNB)** | 좌측 네비게이션 — Figma `ADM / LNB / *` 패턴 | § 7.3 참조 — 메뉴 outer/inner 중첩 + 활성 brand1-subtlest, chevron 없음 |

### 7.3 LNB (Sidebar) 패턴 — Phase D-2.1

Figma `ADM / LNB / *` 컴포넌트와 1:1 정합.

**상단 Header 박스 (로고 + User ID)**
- 컨테이너: `flex flex-col gap-2 px-3.5 py-4 items-start justify-center`
- 로고: `BrandIcon size-[34px] rounded-md` + 앱 이름 `text-sm font-bold text-fg-default leading-5`
- User ID 박스: `bg-bg-token-subtle border border-bd-primary rounded px-2 py-1` + 이메일 `text-xs text-fg-subtle` + more 버튼 `size-[14px]`

**SubTitle (섹션 헤더)**
- 컨테이너: `flex items-center pt-2 px-5 w-full`
- 텍스트: `text-xs font-semibold text-fg-subtlest tracking-[-0.3px] leading-4`
- ❌ uppercase 사용 금지 (sentence case 만)
- ❌ tracking-wider 사용 금지

**메뉴 항목 — 중첩 컨테이너 패턴**
- outer (간격 보장): `flex items-center px-2 py-1 w-full`
- inner (NavLink, 클릭 영역): `flex flex-1 gap-2 items-center min-w-0 px-3 py-2 rounded-md`
- 활성: `bg-bg-token-brand1-subtlest text-fg-brand1`
- 비활성: `text-fg-subtle hover:bg-interaction-hovered`
- 텍스트 weight: 활성/비활성 모두 `font-bold` (Figma 정합)
- 아이콘: `size={20}` 일관
- ❌ chevron 우측 indicator 사용 금지 (Figma 에 없음)
- ❌ admin 섹션 indent (`ml-1.5` 등) 금지 — SubTitle 만으로 그룹 분리

**드롭다운 (사용자 메뉴 등)**
- `absolute left-0 right-0 top-full mt-1 bg-white border border-bd-default rounded-lg shadow-overlay`

### 7.4 Header (PageHeader) 패턴 — Phase D-2.2

Figma `1143:13782` 정합. `usePageHeader()` Context 의 title/subtitle/actions/onBack 슬롯을 받아 렌더.

**컨테이너**
- `h-[92px] bg-bg-token-default border-b border-bd-default flex items-center gap-4 px-6 py-3 sticky top-0 z-10`
- 모바일은 별도 56px 바 (AppLayout.tsx) — 토큰 정합은 이후 Phase 에서

**타이틀 (Display/Small)**
- title 만: `text-2xl font-bold text-fg-default tracking-[-0.3px] leading-10` (24/40)
- title + subtitle: title 의 leading 을 `leading-7` 로 축소 (둘이 함께 92px 안에 수용)
- subtitle: `text-xs text-fg-subtlest mt-0.5 truncate`

**onBack 버튼**
- `size-9 rounded-lg text-fg-subtle hover:bg-interaction-hovered hover:text-fg-default`
- 좌측 chevron 20px

**actions 슬롯**
- 우측 정렬 `flex items-center gap-1.5 flex-wrap justify-end max-w-[60%]`
- primary 버튼은 brand1 채움 (h-10, gap-1.5, px-2.5, rounded-lg) — Figma 정합은 `MsButton size="lg"` 로 자동 충족

**금지**
- ❌ 페이지 본문 상단의 커스텀 `<h1>` → `useSetPageHeader` 만
- ❌ raw 팔레트 (`text-gray-099`, `border-gray-020`) — semantic 토큰 (`text-fg-*`, `border-bd-*`) 사용

### 7.5 Tab strip (HeaderTabsBar) 패턴 — Phase D-2.3

Figma `ADM / Header / Tab` 정합. Header (h-92) 바로 아래의 별도 44px 영역.

**컨테이너** (`HeaderTabsBar` — 자동 렌더, slot 비어있으면 null)
- `hidden md:flex h-[44px] bg-bg-token-default border-b border-bd-default items-center gap-6 px-6 flex-shrink-0`
- 모바일은 일단 hidden — 모바일 디자인 별도 phase 에서 정의

**사용 방법** (`useSetPageHeader` 의 옵션 슬롯)
```tsx
useSetPageHeader('구성원 관리', actions, {
  tabs: (
    <>
      <HeaderTab active>전체</HeaderTab>
      <HeaderTab onClick={() => navigate('?status=pending')}>대기 승인</HeaderTab>
    </>
  ),
  tabActions: (
    <button className="...">필터</button>
  ),
});
```

**HeaderTab 단일 아이템** (`src/components/layout/HeaderTab.tsx`)
- 활성: `border-b-2 border-fg-default text-fg-default`
- 비활성: `border-b-2 border-transparent text-fg-subtle hover:text-fg-default`
- 텍스트: `text-base font-bold tracking-[-0.3px] leading-6` (Figma Title(Bd)/Medium)
- `-mb-px` — 컨테이너 border-b 와 겹치게

**tabActions (우측 작은 버튼 그룹)**
- 자유 ReactNode — 보통 작은 액션 버튼 (h-6, 14px icon, border-bd-subtle, font 12 Bold)
- gap-1.5

**금지**
- ❌ 콘텐츠 영역 안에 직접 `border-b` 탭 그리기 — 헤더 탭 사용
- ❌ ListToolbar `tabs` 슬롯 사용 (deprecated) — 헤더 탭 또는 segments 마이그레이션

### 7.1 ListToolbar 사용 규칙

리스트 페이지(MyReviewList, TeamReviewList, PeerApprovalPage, CycleList, ReceivedReviewList, CycleArchive 등)는 **반드시** `ListToolbar` 를 사용해 필터/검색을 구성합니다.

**대원칙 (2026-04-29 개정 — Phase D-2.3)**

탭 사용 정책이 두 컴포넌트로 명확히 분리됩니다:

| 종류 | 위치 | 컴포넌트 | 쓰임 |
|---|---|---|---|
| **헤더 탭** | Header 바로 아래 (h-44 별도 영역) | `HeaderTab` 안에 `tabs` 슬롯 | **페이지 1차 분류** 또는 **view toggle** (예: 구성원 / 조직도, 사이클 진행 / 종료) |
| **세그먼트 탭** | 콘텐츠 영역 안 ListToolbar | `ListToolbar segments[pills]` | **세부 필터** (상태별, 유형별, 카운트 강조 등) |

- ~~"콘텐츠 영역에 TAB 사용 금지"~~ 정책 폐기 — 헤더 탭은 콘텐츠 영역이 아니므로 충돌 없음
- 단 **콘텐츠 영역 안의 자체 TAB UI** (border-b 강조 탭 직접 작성) 는 여전히 금지 — segments 또는 헤더 탭으로
- ListToolbar 의 `tabs` 슬롯은 **deprecated** — 신규 페이지는 헤더 탭 또는 segments 사용

| 슬롯       | 시각                                            | 쓰임                                      |
|------------|-------------------------------------------------|-------------------------------------------|
| `segments` | pills (≤4 옵션) / select (옵션 多 또는 라벨 길음) | 분류·상태·유형 필터. 여러 개 stack 가능.  |
| `search`   | 우측 정렬, `width='sm'`(56) / `'md'`(80)        | 단일 검색 입력. 페이지에 1개만.           |
| `rightSlot`| 임의                                            | 보조 액션(초기화 등). primary는 PageHeader |
| ~~`tabs`~~ | ~~border-b + count chip~~                        | **deprecated.** segments[pills] 로 대체.   |

**규칙**
- 상태 필터(전체/진행 중/완료/종료됨처럼 카운트 강조 필요)는 `segments[pills]` 의 `count` 필드 사용.
- segments 가 둘 이상이면 `flex-wrap` 으로 자동 다음 줄 배치 (`상태` 다음 `유형` 등).
- search 단독 사용 시 `width='md'` 권장.
- primary action(예: '새 리뷰')은 `useSetPageHeader(title, actions)` 의 `actions` 슬롯, 절대 ListToolbar `rightSlot` 에 넣지 말 것.

**금지**
- ❌ 콘텐츠 영역에 TAB UI (border-b 강조 탭) 사용 — 1차 분류는 LNB 로
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
