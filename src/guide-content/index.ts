/**
 * 가이드 콘텐츠 메타데이터 — single source of truth.
 *
 * 페이지를 추가할 때:
 * 1) 해당 카테고리 폴더에 `<slug>.md` 파일 생성
 * 2) PAGES 배열에 메타 entry 추가 (순서 = 사이드바 표시 순서)
 *
 * 카테고리를 추가할 때:
 * 1) `src/guide-content/<category>/` 폴더 생성
 * 2) CATEGORIES 배열에 entry 추가
 */

import {
  MsHomeIcon,
  MsGroupIcon,
  MsRefreshIcon,
  MsLockIcon,
  MsSettingIcon,
  MsHelpIcon,
} from '../components/ui/MsIcons';

export interface GuideCategory {
  slug: string;
  title: string;
  summary: string;
  icon: typeof MsHomeIcon;
}

export interface GuidePage {
  category: string;
  slug: string;
  title: string;
  summary: string;
}

export const CATEGORIES: GuideCategory[] = [
  {
    slug: 'getting-started',
    title: '시작하기',
    summary: '리뷰시스템 첫 진입 시 알아두면 좋을 기본 안내.',
    icon: MsHomeIcon,
  },
  {
    slug: 'team',
    title: '구성원 관리',
    summary: '구성원 초대·정보 수정·조직 편성·평가권자 배정.',
    icon: MsGroupIcon,
  },
  {
    slug: 'review-cycle',
    title: '리뷰 사이클',
    summary: '템플릿 만들기부터 사이클 발행·운영·종료까지.',
    icon: MsRefreshIcon,
  },
  {
    slug: 'permissions',
    title: '권한 관리',
    summary: '권한 그룹과 멤버 할당으로 접근 범위를 제어합니다.',
    icon: MsLockIcon,
  },
  {
    slug: 'operations',
    title: '운영 도구',
    summary: '감사 로그·알림·대시보드를 통한 운영 보조 기능.',
    icon: MsSettingIcon,
  },
  {
    slug: 'faq',
    title: 'FAQ / 문제 해결',
    summary: '자주 발생하는 차단 메시지와 해결 방법.',
    icon: MsHelpIcon,
  },
];

/**
 * 페이지 순서 = 배열 순서. 이전/다음 네비는 같은 배열 내 인접 entry 로 자동 연결.
 * 카테고리가 다른 인접 페이지로도 자동 연결됨 (책처럼 순차 reading 가능).
 */
export const PAGES: GuidePage[] = [
  // 구성원 관리 (4개)
  {
    category: 'team',
    slug: 'invite-approve',
    title: '구성원 초대와 승인',
    summary: '신규 회원이 SSO 로 로그인하면 대기승인 큐에 들어옵니다. 직무·보고대상을 입력해 활성화합니다.',
  },
  {
    category: 'team',
    slug: 'profile',
    title: '구성원 정보 수정',
    summary: '이름·직무·보고대상·활성 상태 등 구성원 정보를 수정합니다.',
  },
  {
    category: 'team',
    slug: 'org-tree',
    title: '조직 편성',
    summary: '조직을 추가·이름 변경·삭제하고 드래그로 순서/계층을 조정합니다.',
  },
  {
    category: 'team',
    slug: 'reviewer',
    title: '평가권자 배정',
    summary: '구성원별로 1차(직속)·2차 평가권자를 명시적으로 지정합니다.',
  },

  // 리뷰 사이클 (MVP — 4개)
  {
    category: 'review-cycle',
    slug: 'template',
    title: '리뷰 템플릿 만들기',
    summary: '섹션과 질문을 구성해서 재사용 가능한 템플릿을 만듭니다.',
  },
  {
    category: 'review-cycle',
    slug: 'publish',
    title: '리뷰 사이클 발행',
    summary: '대상자·일정·템플릿을 정하고 사전 점검을 거쳐 발행합니다.',
  },
  {
    category: 'review-cycle',
    slug: 'operate',
    title: '리뷰 운영',
    summary: '운영센터에서 진행률·미완료를 모니터링하고 리마인드를 보냅니다.',
  },
  {
    category: 'review-cycle',
    slug: 'close',
    title: '결과 공개와 종료',
    summary: '리뷰 결과를 본인에게 공개하고 사이클을 마감/보관합니다.',
  },
];

export function findPage(category: string, slug: string): GuidePage | undefined {
  return PAGES.find(p => p.category === category && p.slug === slug);
}

export function findCategory(slug: string): GuideCategory | undefined {
  return CATEGORIES.find(c => c.slug === slug);
}

export function pagesInCategory(categorySlug: string): GuidePage[] {
  return PAGES.filter(p => p.category === categorySlug);
}

export function adjacentPages(current: GuidePage): { prev: GuidePage | null; next: GuidePage | null } {
  const idx = PAGES.findIndex(p => p.category === current.category && p.slug === current.slug);
  if (idx === -1) return { prev: null, next: null };
  return {
    prev: idx > 0 ? PAGES[idx - 1] : null,
    next: idx < PAGES.length - 1 ? PAGES[idx + 1] : null,
  };
}

export function pageHref(page: GuidePage): string {
  return `/guide/${page.category}/${page.slug}`;
}

export function categoryFirstPageHref(category: GuideCategory): string | null {
  const first = pagesInCategory(category.slug)[0];
  return first ? pageHref(first) : null;
}
