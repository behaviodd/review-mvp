/**
 * R6: PermissionCode 의 한국어 라벨/설명 + 카테고리 분류.
 */

import type { PermissionCode } from '../types';

export interface PermissionMeta {
  code: PermissionCode;
  label: string;
  description: string;
  category: '리뷰 운영' | '구성원' | '보안' | '시스템';
}

export const PERMISSION_META: Record<PermissionCode, PermissionMeta> = {
  'cycles.manage': {
    code: 'cycles.manage',
    label: '사이클 관리',
    description: '리뷰 사이클 생성·편집·발행·삭제, 마감 연장, 대리 작성 등.',
    category: '리뷰 운영',
  },
  'templates.manage': {
    code: 'templates.manage',
    label: '템플릿 관리',
    description: '리뷰 템플릿 생성·편집·삭제.',
    category: '리뷰 운영',
  },
  'reports.view_all': {
    code: 'reports.view_all',
    label: '전사 리포트 열람',
    description: '전체 사이클 결과·분석 리포트 열람.',
    category: '리뷰 운영',
  },
  'reviewer_assignments.manage': {
    code: 'reviewer_assignments.manage',
    label: '평가권자 배정',
    description: '구성원별 평가권자(차수별 매니저) 지정·변경.',
    category: '구성원',
  },
  'org.manage': {
    code: 'org.manage',
    label: '조직·구성원 관리',
    description: '조직 구조 편집, 구성원 추가·수정·퇴사 처리.',
    category: '구성원',
  },
  'auth.impersonate': {
    code: 'auth.impersonate',
    label: '마스터 로그인',
    description: '다른 구성원으로 접속하여 그 사용자 명의로 리뷰 작성·제출 가능. 관리자 전용 라우트는 차단.',
    category: '보안',
  },
  'audit.view': {
    code: 'audit.view',
    label: '감사 로그 열람',
    description: '시스템 액션·마스터 로그인 이력 등 감사 로그 조회.',
    category: '보안',
  },
  'permission_groups.manage': {
    code: 'permission_groups.manage',
    label: '권한 그룹 관리',
    description: '권한 그룹 생성·편집·삭제·멤버 변경. (소유자 권장)',
    category: '시스템',
  },
  'settings.manage': {
    code: 'settings.manage',
    label: '시스템 설정',
    description: 'Apps Script URL, 동기화 설정 등 시스템 환경 변경.',
    category: '시스템',
  },
};

export const PERMISSION_CATEGORIES: Array<PermissionMeta['category']> = [
  '리뷰 운영', '구성원', '보안', '시스템',
];

export function getPermissionLabel(code: PermissionCode): string {
  return PERMISSION_META[code]?.label ?? code;
}
