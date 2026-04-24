# MsIcons 추가 요청 목록

Phase 3 아이콘 감사 결과, 아래 아이콘이 MsIcons에 없어 Lucide를 임시 사용 중입니다.
DS 디자이너에게 아이콘 추가를 요청해 주세요.

| 우선순위 | Lucide 아이콘 | 용도 | 사용 위치 |
|---|---|---|---|
| 🔴 높음 | `Loader2` | 로딩 스피너 (spin 애니메이션) | LoadingButton, MsButton, AutoSaveIndicator, Login |
| 🔴 높음 | `Eye` | 비밀번호 표시 | ChangePasswordModal, Settings, Login |
| 🔴 높음 | `EyeOff` | 비밀번호 숨김 | ChangePasswordModal, Settings, Login |
| 🔴 높음 | `Users` | 팀/복수 사용자 | Reports, Dashboard, Team, CycleDetail, MyReviewList, TeamReviewWrite, TeamReviewList, CycleNew |
| 🔴 높음 | `Building2` | 조직/부서 | Sidebar, Team |
| 🟡 중간 | `TrendingUp` | 통계/트렌드 | Reports, Dashboard |
| 🟡 중간 | `BarChart2` | 막대 차트 | Reports, CycleDetail, MyReviewList, TemplateBuilder |
| 🟡 중간 | `Shield` | 권한/보안 역할 | Settings |
| 🟡 중간 | `ShieldCheck` | 검증된 역할 | Settings, MyReviewList, TeamReviewWrite, MyReviewWrite |
| 🟡 중간 | `Circle` | 상태 인디케이터 (빈 원) | MyReviewList, TeamReviewList |
| 🟡 중간 | `Target` | 목표 | Goals |
| 🟡 중간 | `Heart` | 좋아요 반응 | Feedback |
| 🟡 중간 | `ThumbsUp` | 긍정 반응 | Feedback |
| 🟡 중간 | `Lightbulb` | 아이디어/팁 | Feedback, MyReviewWrite |
| 🟡 중간 | `BookOpen` | 참고/가이드 | TeamReviewWrite |
| 🟡 중간 | `History` | 이력/수정 내역 | TeamReviewWrite |
| 🟡 중간 | `Save` | 저장 | MyReviewWrite |
| 🟡 중간 | `AlignLeft` | 텍스트 유형 문항 표시 | TemplateBuilder |
| 🟡 중간 | `List` | 리스트 유형 문항 표시 | TemplateBuilder |
| 🟡 중간 | `KeyRound` | 비밀번호/키 | Team |
| 🟡 중간 | `Layers` | 스택/레이어 구조 | Team |
| 🟢 낮음 | `Sheet` | 스프레드시트/내보내기 | Settings |
| 🟢 낮음 | `PartyPopper` | 완료 축하 | MyReviewWrite, CycleNew |
| 🟢 낮음 | `Rocket` | 시작/론칭 | CycleNew |
| 🟢 낮음 | `Brain` | AI/지능 | TemplateBuilder |

## 현황

- 교체 완료: `ChevronDown` → `MsChevronDownIcon`, `Bell` → `MsAlertIcon`, `CheckCheck` → `MsCheckIcon`, `ArrowRight` → `MsChevronRightIcon`
- 임시 유지 중: 위 25개 아이콘 (lucide-react 패키지)
- DS 아이콘 추가 후: `MsIcons.tsx`에 추가하고 각 파일에서 Lucide import 제거 예정
