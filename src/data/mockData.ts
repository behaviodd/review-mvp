import type { User, ReviewCycle, ReviewTemplate, ReviewSubmission, Feedback, Goal, Notification } from '../types';

export const MOCK_USERS: User[] = [
  { id: 'u001', name: '김관리', email: 'admin@company.com', role: 'admin', department: '인사팀', position: '인사팀장', avatarColor: '#4f46e5' },
  { id: 'u002', name: '이개발', email: 'dev.lead@company.com', role: 'manager', department: '개발팀', position: '개발팀장', managerId: 'u001', avatarColor: '#059669' },
  { id: 'u003', name: '박프론트', email: 'front@company.com', role: 'employee', department: '개발팀', position: '시니어 개발자', managerId: 'u002', avatarColor: '#0891b2' },
  { id: 'u004', name: '최백엔드', email: 'back@company.com', role: 'employee', department: '개발팀', position: '개발자', managerId: 'u002', avatarColor: '#7c3aed' },
  { id: 'u005', name: '정주니어', email: 'junior@company.com', role: 'employee', department: '개발팀', position: '주니어 개발자', managerId: 'u002', avatarColor: '#0369a1' },
  { id: 'u006', name: '손디자인', email: 'design.lead@company.com', role: 'manager', department: '디자인팀', position: '디자인팀장', managerId: 'u001', avatarColor: '#6d28d9' },
  { id: 'u007', name: '오UX', email: 'ux@company.com', role: 'employee', department: '디자인팀', position: 'UX 디자이너', managerId: 'u006', avatarColor: '#0f766e' },
  { id: 'u008', name: '임브랜드', email: 'brand@company.com', role: 'employee', department: '디자인팀', position: '브랜드 디자이너', managerId: 'u006', avatarColor: '#be185d' },
];

export const MOCK_TEMPLATES: ReviewTemplate[] = [
  {
    id: 'tmpl_001',
    name: '정기 성과 리뷰 (표준)',
    description: '분기별 성과 및 역량을 종합적으로 평가하는 표준 템플릿입니다.',
    isDefault: true,
    createdBy: 'u001',
    createdAt: '2025-01-10T09:00:00Z',
    questions: [
      { id: 'q01', text: '이번 기간 가장 의미 있었던 성과는 무엇인가요?', type: 'text', target: 'both', isPrivate: false, isRequired: true, order: 1, helpText: '구체적인 프로젝트와 수치를 포함해 작성하세요.', exampleAnswer: 'A 프로젝트에서 응답 속도를 40% 개선하여 사용자 만족도 점수가 4.2에서 4.7로 향상되었습니다.' },
      { id: 'q02', text: '업무 목표 달성도를 평가해 주세요.', type: 'rating', target: 'both', isPrivate: false, ratingScale: 5, isRequired: true, order: 2 },
      { id: 'q03', text: '팀 협업 및 소통 역량을 평가해 주세요.', type: 'competency', target: 'both', isPrivate: false, ratingScale: 5, isRequired: true, order: 3 },
      { id: 'q04', text: '성장을 위해 다음 기간에 집중할 영역은 무엇인가요?', type: 'text', target: 'both', isPrivate: false, isRequired: true, order: 4, helpText: '구체적인 액션 플랜을 포함해 작성하세요.' },
      { id: 'q05', text: '전반적인 역량 수준을 평가해 주세요. (매니저 전용)', type: 'rating', target: 'manager', isPrivate: true, ratingScale: 5, isRequired: true, order: 5 },
      { id: 'q06', text: '이 팀원의 승진/이동 가능성에 대한 의견을 작성해 주세요. (매니저 전용)', type: 'text', target: 'manager', isPrivate: true, isRequired: false, order: 6 },
    ],
  },
  {
    id: 'tmpl_002',
    name: '수시 리뷰 (간소)',
    description: '프로젝트 완료 후 빠르게 진행하는 간소화된 수시 리뷰 템플릿입니다.',
    isDefault: false,
    createdBy: 'u001',
    createdAt: '2025-02-15T09:00:00Z',
    questions: [
      { id: 'q07', text: '이번 프로젝트에서 잘한 점은 무엇인가요?', type: 'text', target: 'both', isPrivate: false, isRequired: true, order: 1 },
      { id: 'q08', text: '프로젝트 기여도를 평가해 주세요.', type: 'rating', target: 'both', isPrivate: false, ratingScale: 5, isRequired: true, order: 2 },
      { id: 'q09', text: '다음 프로젝트에서 개선할 점은?', type: 'text', target: 'both', isPrivate: false, isRequired: false, order: 3 },
    ],
  },
];

export const MOCK_CYCLES: ReviewCycle[] = [
  {
    id: 'cyc_001',
    title: '2025년 상반기 성과 리뷰',
    type: 'scheduled',
    status: 'self_review',
    templateId: 'tmpl_001',
    targetDepartments: ['개발팀', '디자인팀'],
    selfReviewDeadline: '2025-07-15T23:59:59Z',
    managerReviewDeadline: '2025-07-25T23:59:59Z',
    createdBy: 'u001',
    createdAt: '2025-06-20T09:00:00Z',
    completionRate: 42,
  },
  {
    id: 'cyc_002',
    title: '2024년 하반기 성과 리뷰',
    type: 'scheduled',
    status: 'closed',
    templateId: 'tmpl_001',
    targetDepartments: ['개발팀', '디자인팀'],
    selfReviewDeadline: '2025-01-15T23:59:59Z',
    managerReviewDeadline: '2025-01-25T23:59:59Z',
    createdBy: 'u001',
    createdAt: '2024-12-20T09:00:00Z',
    completionRate: 100,
  },
  {
    id: 'cyc_003',
    title: 'Q2 프로젝트 수시 리뷰',
    type: 'adhoc',
    status: 'manager_review',
    templateId: 'tmpl_002',
    targetDepartments: ['개발팀'],
    selfReviewDeadline: '2025-07-05T23:59:59Z',
    managerReviewDeadline: '2025-07-12T23:59:59Z',
    createdBy: 'u001',
    createdAt: '2025-06-25T09:00:00Z',
    completionRate: 75,
  },
];

export const MOCK_SUBMISSIONS: ReviewSubmission[] = [
  // 상반기 리뷰 - 셀프
  { id: 'sub_001', cycleId: 'cyc_001', reviewerId: 'u003', revieweeId: 'u003', type: 'self', status: 'in_progress', answers: [{ questionId: 'q01', textValue: '올해 상반기에 디자인 시스템 컴포넌트 라이브러리를 구축하여 개발 생산성을 30% 향상시켰습니다.' }, { questionId: 'q02', ratingValue: 4 }], lastSavedAt: '2025-07-10T14:30:00Z' },
  { id: 'sub_002', cycleId: 'cyc_001', reviewerId: 'u004', revieweeId: 'u004', type: 'self', status: 'submitted', answers: [{ questionId: 'q01', textValue: 'API 성능 최적화로 응답시간 40% 개선을 달성했습니다.' }, { questionId: 'q02', ratingValue: 4 }, { questionId: 'q03', ratingValue: 5 }, { questionId: 'q04', textValue: '클라우드 인프라 역량 강화에 집중할 계획입니다.' }], lastSavedAt: '2025-07-08T11:00:00Z', submittedAt: '2025-07-08T11:00:00Z', overallRating: 4.5 },
  { id: 'sub_003', cycleId: 'cyc_001', reviewerId: 'u005', revieweeId: 'u005', type: 'self', status: 'not_started', answers: [], lastSavedAt: '2025-07-01T00:00:00Z' },
  { id: 'sub_004', cycleId: 'cyc_001', reviewerId: 'u007', revieweeId: 'u007', type: 'self', status: 'submitted', answers: [{ questionId: 'q01', textValue: '사용자 조사 기반 UX 개선으로 전환율 25% 향상에 기여했습니다.' }, { questionId: 'q02', ratingValue: 5 }, { questionId: 'q03', ratingValue: 4 }, { questionId: 'q04', textValue: '모바일 UX 전문성을 높이겠습니다.' }], lastSavedAt: '2025-07-09T16:00:00Z', submittedAt: '2025-07-09T16:00:00Z', overallRating: 4.8 },
  { id: 'sub_005', cycleId: 'cyc_001', reviewerId: 'u008', revieweeId: 'u008', type: 'self', status: 'not_started', answers: [], lastSavedAt: '2025-07-01T00:00:00Z' },
  // 매니저 하향 리뷰
  { id: 'sub_006', cycleId: 'cyc_001', reviewerId: 'u002', revieweeId: 'u003', type: 'downward', status: 'in_progress', answers: [{ questionId: 'q02', ratingValue: 4 }, { questionId: 'q03', ratingValue: 3 }], lastSavedAt: '2025-07-11T10:00:00Z' },
  { id: 'sub_007', cycleId: 'cyc_001', reviewerId: 'u002', revieweeId: 'u004', type: 'downward', status: 'not_started', answers: [], lastSavedAt: '2025-07-01T00:00:00Z' },
  { id: 'sub_008', cycleId: 'cyc_001', reviewerId: 'u002', revieweeId: 'u005', type: 'downward', status: 'not_started', answers: [], lastSavedAt: '2025-07-01T00:00:00Z' },
  // 이전 사이클 제출
  { id: 'sub_009', cycleId: 'cyc_002', reviewerId: 'u003', revieweeId: 'u003', type: 'self', status: 'submitted', answers: [{ questionId: 'q01', textValue: '컴포넌트 설계 표준화 작업 완료' }, { questionId: 'q02', ratingValue: 4 }], lastSavedAt: '2025-01-13T14:00:00Z', submittedAt: '2025-01-13T14:00:00Z', overallRating: 4.0 },
  // 이전 사이클 - 팀장이 팀원(u003)에 대해 작성한 제출 완료 하향 리뷰
  { id: 'sub_012', cycleId: 'cyc_002', reviewerId: 'u002', revieweeId: 'u003', type: 'downward', status: 'submitted', answers: [{ questionId: 'q01', textValue: '하반기 컴포넌트 설계 표준화를 성공적으로 주도하여 팀 전체 개발 생산성 향상에 크게 기여했습니다. 재사용 가능한 UI 컴포넌트를 30개 이상 구축한 것은 특히 인상적이었습니다.' }, { questionId: 'q02', ratingValue: 4 }, { questionId: 'q03', ratingValue: 4 }, { questionId: 'q04', textValue: '다음 기간에는 시스템 아키텍처 설계 역량을 더욱 강화하여 더 큰 프로젝트를 주도할 수 있도록 성장해 주길 기대합니다.' }], lastSavedAt: '2025-01-20T14:00:00Z', submittedAt: '2025-01-20T14:00:00Z', overallRating: 4.0 },
  // 어드민(u001)이 직속 팀원 u002를 평가한 하향 리뷰 (제출 완료)
  { id: 'sub_mgr_u001_u002_cyc_001', cycleId: 'cyc_001', reviewerId: 'u001', revieweeId: 'u002', type: 'downward', status: 'submitted', answers: [{ questionId: 'q01', textValue: '개발팀 전체의 상반기 목표 달성을 성공적으로 이끌었습니다. 신규 기술 스택 도입과 팀원 역량 향상 프로그램을 병행하며 팀 성과를 극대화했습니다.' }, { questionId: 'q02', ratingValue: 5 }, { questionId: 'q03', ratingValue: 4 }, { questionId: 'q04', textValue: '다음 기간에는 채용과 팀 확장에 집중하여 조직의 성장을 가속화해주길 기대합니다.' }], lastSavedAt: '2025-07-20T10:00:00Z', submittedAt: '2025-07-20T10:00:00Z', overallRating: 4.5 },
  // 매니저 셀프 리뷰
  { id: 'sub_010', cycleId: 'cyc_001', reviewerId: 'u002', revieweeId: 'u002', type: 'self', status: 'in_progress', answers: [{ questionId: 'q01', textValue: '팀 전체 성과 목표 달성 및 신규 기술 스택 도입 성공' }], lastSavedAt: '2025-07-10T09:00:00Z' },
  { id: 'sub_011', cycleId: 'cyc_001', reviewerId: 'u006', revieweeId: 'u006', type: 'self', status: 'not_started', answers: [], lastSavedAt: '2025-07-01T00:00:00Z' },
];

export const MOCK_FEEDBACK: Feedback[] = [
  { id: 'fb_001', fromUserId: 'u002', toUserId: 'u003', type: 'praise', content: '이번 스프린트에서 코드 리뷰를 매우 꼼꼼하게 해주셔서 팀 전체 품질이 올라갔습니다. 특히 Edge case를 잘 잡아주셨어요!', isAnonymous: false, createdAt: '2025-07-05T10:00:00Z' },
  { id: 'fb_002', fromUserId: 'u004', toUserId: 'u003', type: 'praise', content: 'API 설계 관련 도움을 주셔서 제 업무 효율이 크게 향상되었습니다. 감사합니다!', isAnonymous: false, createdAt: '2025-07-03T15:30:00Z' },
  { id: 'fb_003', fromUserId: 'u001', toUserId: 'u003', type: 'suggestion', content: '문서화 작업을 조금 더 체계적으로 진행하면 팀 전체가 도움이 될 것 같습니다.', isAnonymous: true, createdAt: '2025-06-28T11:00:00Z' },
  { id: 'fb_004', fromUserId: 'u002', toUserId: 'u004', type: 'praise', content: '서버 최적화 작업 정말 잘 해주셨어요. 응답속도 개선이 확실히 체감됩니다.', isAnonymous: false, createdAt: '2025-07-07T14:00:00Z' },
  { id: 'fb_005', fromUserId: 'u006', toUserId: 'u007', type: 'praise', content: '사용자 인터뷰 분석 보고서 정말 인상적이었습니다. 인사이트가 풍부했어요!', isAnonymous: false, createdAt: '2025-07-06T09:00:00Z' },
  { id: 'fb_006', fromUserId: 'u003', toUserId: 'u002', type: 'suggestion', content: '팀 회의 시간을 좀 더 효율적으로 운영하면 좋겠습니다. 아젠다 공유를 미리 해주시면 감사하겠습니다.', isAnonymous: true, createdAt: '2025-07-02T10:00:00Z' },
];

export const MOCK_GOALS: Goal[] = [
  { id: 'g001', userId: 'u003', title: '디자인 시스템 컴포넌트 라이브러리 구축', description: 'Storybook 기반의 재사용 가능한 UI 컴포넌트 라이브러리 50개 이상 구축', progress: 78, dueDate: '2025-08-31', status: 'on_track', cycleId: 'cyc_001' },
  { id: 'g002', userId: 'u003', title: 'TypeScript 마이그레이션 완료', description: '레거시 JavaScript 코드베이스를 100% TypeScript로 마이그레이션', progress: 45, dueDate: '2025-09-30', status: 'at_risk', cycleId: 'cyc_001' },
  { id: 'g003', userId: 'u003', title: '성능 최적화 - Core Web Vitals', description: 'LCP, FID, CLS 모든 지표 Good 등급 달성', progress: 100, dueDate: '2025-06-30', status: 'completed' },
  { id: 'g004', userId: 'u004', title: 'API 응답시간 50% 개선', description: 'DB 쿼리 최적화 및 캐싱 레이어 도입', progress: 90, dueDate: '2025-07-31', status: 'on_track', cycleId: 'cyc_001' },
  { id: 'g005', userId: 'u004', title: 'AWS 자격증 취득', description: 'AWS Solutions Architect Professional 자격증 취득', progress: 60, dueDate: '2025-09-30', status: 'on_track' },
  { id: 'g006', userId: 'u002', title: '팀 역량 강화 프로그램 운영', description: '월 1회 기술 세미나 및 분기 1회 외부 교육 지원', progress: 67, dueDate: '2025-12-31', status: 'on_track' },
  { id: 'g007', userId: 'u007', title: '사용자 조사 체계 구축', description: '정기 사용자 인터뷰 프로세스 및 리서치 레포지토리 구축', progress: 55, dueDate: '2025-08-15', status: 'on_track', cycleId: 'cyc_001' },
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'n001', userId: 'u003', title: '성장 돌아보기 마감 임박', message: '2025년 상반기 성과 리뷰 마감까지 5일 남았습니다. 지금 시작해보세요!', type: 'deadline', isRead: false, createdAt: '2025-07-10T09:00:00Z', actionUrl: '/reviews/me' },
  { id: 'n002', userId: 'u003', title: '새 피드백을 받았습니다', message: '이개발님이 회원님에게 칭찬 피드백을 보냈습니다.', type: 'feedback', isRead: false, createdAt: '2025-07-05T10:05:00Z', actionUrl: '/feedback' },
  { id: 'n003', userId: 'u003', title: '새 피드백을 받았습니다', message: '익명으로부터 피드백을 받았습니다.', type: 'feedback', isRead: true, createdAt: '2025-06-28T11:05:00Z', actionUrl: '/feedback' },
  { id: 'n004', userId: 'u002', title: '팀원 리뷰 작성이 필요합니다', message: '2025년 상반기 성과 리뷰에서 3명의 팀원 리뷰 작성이 필요합니다.', type: 'deadline', isRead: false, createdAt: '2025-07-08T09:00:00Z', actionUrl: '/reviews/team' },
  { id: 'n005', userId: 'u002', title: '새 피드백을 받았습니다', message: '익명으로부터 제안 피드백을 받았습니다.', type: 'feedback', isRead: true, createdAt: '2025-07-02T10:05:00Z', actionUrl: '/feedback' },
  { id: 'n006', userId: 'u001', title: '독촉 알림 발송 완료', message: '개발팀 미제출자 3명에게 독촉 알림이 발송되었습니다.', type: 'nudge', isRead: true, createdAt: '2025-07-09T11:00:00Z' },
  { id: 'n007', userId: 'u004', title: '성장 돌아보기 마감 임박', message: '2025년 상반기 성과 리뷰 마감까지 5일 남았습니다.', type: 'deadline', isRead: false, createdAt: '2025-07-10T09:00:00Z', actionUrl: '/reviews/me' },
  { id: 'n008', userId: 'u005', title: '성장 돌아보기를 시작해 주세요', message: '2025년 상반기 성과 리뷰가 시작되었습니다. 마감: 7월 15일', type: 'deadline', isRead: false, createdAt: '2025-07-01T09:00:00Z', actionUrl: '/reviews/me' },
];

export const DEPARTMENT_STATS = [
  { department: '개발팀', completionRate: 42, total: 4, submitted: 2 },
  { department: '디자인팀', completionRate: 50, total: 2, submitted: 1 },
  { department: '마케팅팀', completionRate: 80, total: 5, submitted: 4 },
  { department: '영업팀', completionRate: 90, total: 6, submitted: 5 },
];

export const RATING_LABELS: Record<number, string> = {
  1: '매우 미흡',
  2: '미흡',
  3: '보통',
  4: '우수',
  5: '매우 우수',
};

export const GRADE_FROM_RATING = (rating: number): string => {
  if (rating >= 4.5) return 'S';
  if (rating >= 3.5) return 'A';
  if (rating >= 2.5) return 'B';
  if (rating >= 1.5) return 'C';
  return 'D';
};
