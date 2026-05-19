# review-mvp ↔ Makestar Studio React DS 정합 Audit

> 작성: 2026-05-18 · 참조: https://makestarlab.github.io/product-studio-platform/react/
> 본 문서 = audit 1차 (매핑 매트릭스 + 우선순위 분류). 실제 마이그레이션은 별도 phase.

---

## 1. 목적·범위

- review-mvp 의 자체 UI primitive (`src/components/ui/Ms*`, `src/components/layout/*`) 와 Makestar Studio React DS (Vue v0.3.0 기반) 의 정합 / 불일치 / 누락 정리
- DS 가 단일 진실의 원천 — review-mvp 는 가능한 한 DS 패턴 따라가되, React 적응이 필요한 부분은 분기
- **본 audit 는 코드 변경 없음** — 매트릭스 + 후속 phase 우선순위 결정만

### review-mvp 의 inventory
**`src/components/ui/` (19개)**: AutoSaveIndicator, ConfirmDialog, EmptyIllustration, EmptyState, Field, ListToolbar, LoadingButton, MsActionMenu, MsButton, MsControl (안에 MsCheckbox/MsRadio/MsSwitch/MsInput/MsTextarea 5 export), MsIcons, Pill, ProgressBar, SectionCard, SideDrawer, StatusBadge, Toast, UserAvatar
**`src/components/layout/` (5개)**: AppLayout, Header, HeaderTab, HeaderTabsBar, Sidebar

### DS 20개 컴포넌트
Avatar, Badge, BottomSheet, Button, ButtonGroup, Chip, Control, DataTable, DatePicker, Dialog, DropdownList, Infobox, Input, ListItem, Pagination, SegmentControl, Selector, Tab, Toast, Tooltip, TopNavigation

---

## 2. 정합 매트릭스

| # | DS 컴포넌트 | review-mvp 매핑 | 정합 | 차이 / 메모 |
|---|---|---|---|---|
| 1 | Avatar | UserAvatar | ✅ | 이름만 다름. size 정합 확인 필요 |
| 2 | Badge | StatusBadge | ✅ | review-mvp 가 status 전용으로 특화 |
| 3 | BottomSheet | — | ❌ | 누락. 모바일 미사용 환경이라 우선순위 낮음 |
| 4 | Button | MsButton | ✅ | size 5단계 (sm 24 / md 32 / lg 40 / xl 48 / xxl 56) **DS 완전 일치** — 명명만 `2xl` vs `xxl` 미세 차이 |
| 5 | ButtonGroup | — | ❌ | 누락. 자체 grouping 으로 대체 사용 |
| 6 | Chip | Pill | ⚠️ | 이름 다름. Pill (tone + xs/sm/md) ≈ Chip + Badge 혼합. 분리 검토 |
| 7 | Control | MsControl (5 export) | ⚠️ | DS = 단일 컴포넌트 (type prop). review-mvp = MsCheckbox/MsRadio/MsSwitch/MsInput/MsTextarea 분리. **React 적합 패턴이라 차이 자체는 정합** — 단 명명/API 통일성 검토 |
| 8 | DataTable | OpsTable / 자체 시트형 | ⚠️ | 자체 구현. DS DataTable 미사용. OpsTable 은 도메인 특화로 분리 합리 |
| 9 | DatePicker | (HTML `<input type="date">` 추정) | ❌ | 누락 — DS DatePicker 미적용. 사이클 일정 등에서 native input 사용 중일 가능성 |
| 10 | Dialog | ConfirmDialog / `review/modals/ModalShell` | ⚠️ | 이름 다름. Dialog 의 size 5단계 (xs 320 / sm 400 / md 600 / lg 800 / xl 1200) vs ModalShell 의 widthClass props (max-w-md 등). 정합 매핑 검토 |
| 11 | DropdownList | MsActionMenu? | ⚠️ | MsActionMenu 가 DropdownList 와 유사한 역할일 가능성. 내부 확인 필요 |
| 12 | Infobox | — | ❌ | 누락. Toast / 인라인 안내문 으로 대체 사용 중 |
| 13 | Input | MsInput | ⚠️ | review-mvp size 2단계 (sm/md) vs DS 3단계 (sm 32 / md 40 / lg 48). lg 추가 검토 |
| 14 | ListItem | — | ❌ | 누락. 자체 list 구현 (시트형 패턴 / `docs/ui-tokens.md` § 7) |
| 15 | Pagination | — | ❌ | 누락. 현재 페이지네이션 사용 화면 부재일 가능성 |
| 16 | SegmentControl | OpsFilterBar / ListToolbar 의 segmented | ⚠️ | 자체 구현 (`handoff-2026-05-06` § 2-2 의 `text-base + leading-5 + h-7`). DS SegmentControl 표준화 가능 |
| 17 | Selector | — | ❌ | 누락. select 가 필요한 곳은 native `<select>` 또는 자체 dropdown 사용 추정 |
| 18 | Tab | HeaderTab / HeaderTabsBar | ⚠️ | 자체 구현. DS Tab 과 시각 정합 확인 필요 |
| 19 | Toast | Toast | ✅ | 매핑 정합 (size/tone 등 미세 차이 가능) |
| 20 | Tooltip | — | ❌ | 누락. 사용 빈도 높지 않으나 키 안내 등에 유용 |
| — | TopNavigation | Header | ⚠️ | 자체 구현 |

### review-mvp 에 있고 DS 에 없는 컴포넌트
- AutoSaveIndicator, EmptyIllustration, EmptyState, Field, ListToolbar, LoadingButton, ProgressBar, SectionCard, SideDrawer (right drawer), AppLayout — 모두 **도메인/레이아웃 특화**로 적정

---

## 3. 토큰 정합

### 색상
- **Semantic 명명**: ✅ 정합 — DS `color.fg.base.default` ≈ review-mvp `text-fg-default`
- **Elevated surface**: ✅ — `elevated.surface.default/raised` 의미 동일 (`docs/handoff-2026-05-06` § 1 명시)
- **Brand1 = pink**: ✅
- **Gray scale**: ⚠️ DS = `gray-010~990` (10단계). review-mvp = `gray-005~990` (005 추가로 한 단계 더 세분). 명명 동기화 후보
- **raw `text-gray-080/070/060` 일괄 매핑**: ⚠️ `docs/handoff-2026-05-06` § 4-3 / `handoff-2026-05-18` § 4-4 의 미해결 phase. DS 가 `fg.base.subtle / subtler / subtlest` 같은 단계를 어떻게 잡았는지 추가 fetch 후 매핑 정리 필요

### 타이포
- **본문 16px**: ✅ DS `text-body-lg` (16/24) = review-mvp `text-base` (D-3.J 매핑 결과)
- **LNB 14px 예외**: ✅ DS `text-body-md` (14/20) = review-mvp Sidebar (handoff § 2-2)
- **명명 차이**: DS 의 `text-body-lg-regular` 같은 시멘틱 토큰 vs review-mvp Tailwind 기본 토큰 (`text-base`, `text-sm`). 의미 정합되어 있으나 명명 미동기
- **font-family**: DS = Pretendard Variable. review-mvp 확인 필요 (`index.html` / `tailwind.config`)

### 아이콘
- DS: 176개 ("Foundation/Icons")
- review-mvp: MsIcons (자체 set, `MsHomeIcon` `MsProfileIcon` 등). 명명 다름. 누락 아이콘 / 추가 아이콘 비교는 별도 phase

---

## 4. 우선순위 분류

### P0 (정합 / 변경 불요)
- MsButton (size 5단계 DS 완전 일치)
- UserAvatar ≈ Avatar
- Toast
- Semantic color 토큰 (fg/bg/elevated/brand)
- 본문 16px / LNB 14px

### P1 (Phase DS-1 — 2026-05-18 완료)
1. ~~Pill ↔ Chip / Badge 분리~~ → **분리 불필요 결론**. 48건 사용처 조사 결과 모두 단순 status indicator (tone + xs/sm size + label, 인터랙티브 패턴 0건). DS Badge 의미로 확정. 향후 closable Chip 요구 발생 시 별도 신설
2. ✅ **MsInput lg size 추가** — `lg: 'px-3.5 py-3 text-base rounded-lg'` (≈48px) + leftSlot/rightSlot 의 pl-10/pr-10 분기 추가
3. ~~gray-005 토큰 정리~~ → **유지 결론**. review-mvp `gray-001 (#fcfdfd) = DS gray-010` (hex 동일, 명명만 다름). `gray-005 (#f0f3f4)` 는 DS 에 직접 매핑 없는 **별도 중간 톤** (113건 사용 중). DS scale 의 확장으로 유지. 폐기 시 시각 회귀 큼
4. ✅ **MsButton `xxl` → `2xl`** — Size type + SIZE map key 변경. 외부 사용처 0건 (자체 사용만)

### P2 (자체 구현 → DS 패턴으로 마이그레이션) — Phase DS-2 / P1-C 라운드 14 완료
5. ✅ **SegmentControl** — `src/components/ui/SegmentControl.tsx` 신설. ListToolbar 의 SegmentPills + OpsFilterBar 의 Segment 자체구현 2종을 단일 컴포넌트로 통일. size sm/md/lg + fullWidth + count badge.
6. ✅ **Dialog ↔ ModalShell** — ModalShell 에 `size?: ModalSize` prop 추가 (xs 320/sm 400/md 600/lg 800/xl 1200 → max-w-xs/md/xl/3xl/6xl 매핑). widthClass 는 backwards-compat 으로 유지 (deprecated).
7. ✅ **Tab ↔ HeaderTab / ListToolbar tab strip** — `src/components/ui/Tab.tsx` 신설. HeaderTab 은 Tab 의 wrapper 로 정리. ListToolbar 안의 자체 tab strip 도 Tab 컴포넌트 사용. count badge 패턴 흡수.
8. ✅ **DropdownList ↔ MsActionMenu** — 의미 정합. MsActionMenu 가 DS DropdownList 의 'icon-more' trigger 패턴으로 단일 재사용 컴포넌트 (사용처 13곳). 자체 구현 아님 — 별도 마이그레이션 불필요. 다른 trigger (button/text/select-like) 가 도메인에 필요해지면 trigger prop 확장으로 처리.

### P3 (DS 에 있고 review-mvp 누락 — 신설 검토)
9. **Tooltip** — 사용 빈도 미세하나 키 안내 / 권한 hint 등에 유용
10. **Pagination** — 현재 페이지네이션 미사용. 향후 audit log / 리뷰 목록 등에서 필요해질 가능성
11. **DatePicker** — 사이클 일정 입력에 native input 대신 DS DatePicker 채택 검토
12. **Selector** — 현재 native `<select>` / 자체 dropdown 사용 → DS Selector (trigger 4종) 채택 검토
13. **Infobox** — 인라인 안내 박스 표준화
14. **ListItem** — 시트형 리스트와의 관계. DS ListItem 표준 채택 시 ui-tokens § 7 갱신 필요

### P4 (모바일 / 누락 / 도메인 특화로 우선순위 낮음)
15. **BottomSheet** — 모바일 미사용 환경이라 미적용 합리
16. **ButtonGroup** — 자체 grouping 으로 대체 가능
17. **TopNavigation ↔ Header** — 자체 Header 가 도메인 특화

---

## 5. 권장 phase 계획

### Phase DS-1 (작업 1일 이내)
- P1 4건 모두 — Pill 분리, MsInput lg, gray-005 정리, MsButton xxl→2xl
- handoff 의 § 4-4 raw text-gray-080/070/060 매핑 phase 와 같이 진행 가능

### Phase DS-2 (작업 2~3일)
- P2 4건 — SegmentControl, Dialog/ModalShell, Tab, DropdownList. 자체 구현 → DS 패턴 마이그레이션
- 영향 범위 큼 — 여러 화면의 시각 회귀 점검 필요

### Phase DS-3 (선택 — 신규 컴포넌트)
- P3 6건 신설. 도메인 요구 발생 시 case-by-case
- DatePicker 는 사이클 일정 입력 UX 개선에 가장 fit

### 후순위
- P4 3건 — 필요 시점에 결정

---

## 6. Open Questions

1. ~~DS 의 정확한 raw gray 단계~~ → **해소 (Phase DS-1)**: review-mvp `gray-001 = #fcfdfd = DS gray-010` (명명만 다름). review-mvp 가 `gray-005 (#f0f3f4)` 라는 중간 톤을 추가한 확장 scale. 폐기 X
2. **MsControl 의 React 적응 패턴**: 단일 component (DS) vs 다중 export (review-mvp). 합의 후 명문화 — `docs/ui-tokens.md` 업데이트
3. **font-family Pretendard Variable**: review-mvp 가 실제로 Pretendard 를 쓰는지 (index.html / tailwind / CSS 확인 필요)
4. **DS DatePicker 채택 여부**: 사이클 일정 (CycleNew Step 3 / CycleEdit) 에서 native input 만 사용 중인지, 자체 DatePicker 가 있는지
5. **DS DataTable vs OpsTable**: OpsTable 은 운영센터의 KPI/filter/select 가 결합된 도메인 특화. DataTable 표준화 vs 분리 유지 결정
6. **token 명명 동기**: Tailwind 기본 (`text-base`)  ↔ DS (`text-body-lg-regular`). semantic alias 도입 검토 — 코드 가독성 + DS 동기 트레이드오프
7. **MsInput sm size 28→32 정합**: 본 phase 에서 lg 만 추가. DS sm = 32px 와 review-mvp sm = ~28px 미세 차이. 향후 별도 검토

---

## 7. 본 audit 의 결론

- **MsButton, Avatar, Toast, semantic color, 본문 size 는 이미 DS 정합**
- **P1 4건은 빠른 정합 가능** (반나절 작업)
- **P2 4건은 큰 마이그레이션** (자체 구현 → DS 패턴) — 별도 phase 권장
- **P3 6건은 신설 검토** — 도메인 요구 시점에 case-by-case
- 토큰 (color/typography) 은 의미 정합되어 있으나 **명명 동기 미실시**

다음 step 후보:
- **a.** Phase DS-1 (P1 4건) 즉시 진행
- **b.** Open Question 6개 먼저 해소 후 Phase 결정
- **c.** Phase DS-2 의 특정 항목 (예: Dialog↔ModalShell) 단독 진행
- **d.** P3 신설 컴포넌트 중 우선순위 (예: DatePicker / Tooltip)

---

작성: 2026-05-18 · 본 audit 는 마이그레이션 가이드의 1차 매트릭스. 코드 변경 없음. 다음 phase 시작 시 본 문서 참조.
