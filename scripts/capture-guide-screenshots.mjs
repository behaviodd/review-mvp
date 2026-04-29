/**
 * 가이드 페이지용 스크린샷 자동 캡처 스크립트.
 *
 * 사용법:
 *   1) dev 서버가 5174 에서 실행 중이어야 함 (`npm run dev -- --port 5174`)
 *   2) `node scripts/capture-guide-screenshots.mjs`
 *
 * 동작:
 *   - Playwright Chromium 헤드리스 (DPR 2x, 1440 viewport)
 *   - addInitScript 로 localStorage 에 demo 시드 직접 주입 → admin 로그인 + 데모 데이터로 진입
 *   - docs/guide-screenshots.md § 6 의 12장을 순서대로 캡처
 *   - 결과 → public/guide-images/review-cycle/*.png
 *
 * 캡처 범위 한계:
 *   - preflight 모달 등 클릭 시퀀스 필요한 화면은 추가 인터랙션 후 캡처
 *   - 사이클이 비어있는 페이지는 비어있는 채로 캡처됨 → 이런 경우 캡처 안 하고 skip 가능
 */

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public/guide-images/review-cycle');

const BASE = 'http://localhost:5174';
const NOW = new Date('2026-04-29T09:00:00').toISOString();
const FUTURE = new Date('2026-05-30T18:00:00').toISOString().slice(0, 10);
const FUTURE_LATER = new Date('2026-06-15T18:00:00').toISOString().slice(0, 10);

fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── DEMO SEED ─────────────────────────────────────────────────────────

const adminUser = {
  id: 'A001', name: '김관리', email: 'kim.admin@makestar.com',
  role: 'admin', position: '인사팀장', department: '경영지원', jobFunction: 'HR',
  avatarColor: '#FF558F', orgUnitId: 'ou_root', activityStatus: 'active',
};

const users = [
  adminUser,
  { id: 'M001', name: '이리더', email: 'lee.leader@makestar.com', role: 'leader', position: '개발팀장', department: '제품개발', jobFunction: '개발', avatarColor: '#3B82F6', orgUnitId: 'ou_dev', activityStatus: 'active', managerId: 'A001' },
  { id: 'M002', name: '박개발', email: 'park.dev@makestar.com',   role: 'member', position: '시니어 개발자', department: '제품개발', jobFunction: '개발', avatarColor: '#10B981', orgUnitId: 'ou_dev', activityStatus: 'active', managerId: 'M001' },
  { id: 'M003', name: '최디자이너', email: 'choi.design@makestar.com', role: 'member', position: '프로덕트 디자이너', department: '디자인', jobFunction: '디자인', avatarColor: '#F59E0B', orgUnitId: 'ou_design', activityStatus: 'active', managerId: 'A001' },
  { id: 'M004', name: '정마케터', email: 'jung.market@makestar.com', role: 'member', position: '마케팅 매니저', department: '마케팅', jobFunction: '마케팅', avatarColor: '#8B5CF6', orgUnitId: 'ou_marketing', activityStatus: 'active', managerId: 'A001' },
  // 의도적으로 managerId 없음 — preflight 차단 시나리오용
  { id: 'M005', name: '강신입', email: 'kang.new@makestar.com',    role: 'member', position: '주니어 개발자', department: '제품개발', jobFunction: '개발', avatarColor: '#EC4899', orgUnitId: 'ou_dev', activityStatus: 'active' },
];

const orgUnits = [
  { id: 'ou_root',      name: '메이크스타',  type: 'company',    parentId: undefined, headId: 'A001', order: 0 },
  { id: 'ou_dev',       name: '제품개발',    type: 'department', parentId: 'ou_root', headId: 'M001', order: 1 },
  { id: 'ou_design',    name: '디자인',      type: 'department', parentId: 'ou_root', headId: 'A001', order: 2 },
  { id: 'ou_marketing', name: '마케팅',      type: 'department', parentId: 'ou_root', headId: 'A001', order: 3 },
];

const defaultTemplate = {
  id: 'tpl_default',
  name: '기본 정기 리뷰 템플릿',
  description: '회사 표준 분기 리뷰 양식',
  isDefault: true,
  createdBy: 'system', createdAt: '2025-01-01T00:00:00.000Z',
  sections: [
    { id: 'sec_perf',   name: '성과', order: 0 },
    { id: 'sec_growth', name: '역량 · 성장', order: 1 },
    { id: 'sec_collab', name: '협업', order: 2 },
  ],
  questions: [
    { id: 'q_perf_1',   text: '이번 분기 가장 임팩트 있었던 성과를 구체적인 사례와 함께 작성해주세요.', type: 'long_text', target: 'self',   isPrivate: false, isRequired: true,  order: 0, sectionId: 'sec_perf' },
    { id: 'q_perf_2',   text: '계획했으나 달성하지 못한 목표가 있다면 그 원인은 무엇인가요?',           type: 'long_text', target: 'self',   isPrivate: false, isRequired: false, order: 1, sectionId: 'sec_perf' },
    { id: 'q_growth_1', text: '직무 역량은 이번 분기에 어떻게 성장했나요?',                              type: 'long_text', target: 'both',   isPrivate: false, isRequired: true,  order: 2, sectionId: 'sec_growth' },
    { id: 'q_growth_2', text: '본인의 역량을 평가해주세요',                                                type: 'rating',    target: 'both',   isPrivate: false, isRequired: true,  ratingScale: 5, order: 3, sectionId: 'sec_growth' },
    { id: 'q_collab_1', text: '동료들과의 협업에서 본인의 강점은 무엇이었나요?',                          type: 'long_text', target: 'both',   isPrivate: false, isRequired: true,  order: 4, sectionId: 'sec_collab' },
    { id: 'q_collab_2', text: '리더로서 코멘트를 남겨주세요',                                              type: 'long_text', target: 'leader', isPrivate: true,  isRequired: false, order: 5, sectionId: 'sec_collab' },
  ],
};

const customTemplate = {
  id: 'tpl_engineering',
  name: '엔지니어링 트랙 리뷰',
  description: '개발 직군 전용 - 기술 역량과 코드 품질 항목 강화',
  isDefault: false,
  createdBy: 'A001', createdAt: '2026-03-15T00:00:00.000Z',
  sections: [
    { id: 'sec_tech', name: '기술 역량', order: 0 },
    { id: 'sec_qual', name: '코드 품질', order: 1 },
  ],
  questions: [
    { id: 'q_tech_1', text: '이번 분기에 새롭게 학습한 기술/도구는 무엇인가요?', type: 'long_text', target: 'self', isPrivate: false, isRequired: true, order: 0, sectionId: 'sec_tech' },
    { id: 'q_qual_1', text: '코드 리뷰 품질을 평가해주세요',                       type: 'rating',    target: 'both', isPrivate: false, isRequired: true, ratingScale: 5, order: 1, sectionId: 'sec_qual' },
  ],
};

// 진행 중 사이클 + 제출물
const cycle = {
  id: 'cyc_2026_q1',
  title: '2026년 1분기 정기 리뷰',
  type: 'scheduled', status: 'active', templateId: 'tpl_default',
  targetDepartments: [], createdBy: 'A001', createdAt: '2026-04-15T00:00:00.000Z',
  selfReviewDeadline: FUTURE,
  managerReviewDeadline: FUTURE_LATER,
  completionRate: 60,
  reviewKinds: ['self', 'downward'],
  downwardReviewerRanks: [1],
  targetMode: 'users',
  targetUserIds: ['M001', 'M002', 'M003', 'M004'],
  templateSnapshot: defaultTemplate,
  templateSnapshotAt: '2026-04-15T00:00:00.000Z',
};

const archivedCycle = {
  id: 'cyc_2025_q4',
  title: '2025년 4분기 정기 리뷰',
  type: 'scheduled', status: 'closed', templateId: 'tpl_default',
  targetDepartments: [], createdBy: 'A001', createdAt: '2025-12-15T00:00:00.000Z',
  selfReviewDeadline: '2026-01-15',
  managerReviewDeadline: '2026-01-31',
  completionRate: 100,
  archivedAt: '2026-02-10T00:00:00.000Z',
  reviewKinds: ['self', 'downward'],
  targetMode: 'users',
  targetUserIds: ['M001', 'M002', 'M003', 'M004'],
};

const submissions = [
  // self
  { id: 'sub_self_M001', cycleId: cycle.id, reviewerId: 'M001', revieweeId: 'M001', type: 'self', status: 'submitted',   answers: [], lastSavedAt: NOW },
  { id: 'sub_self_M002', cycleId: cycle.id, reviewerId: 'M002', revieweeId: 'M002', type: 'self', status: 'submitted',   answers: [], lastSavedAt: NOW },
  { id: 'sub_self_M003', cycleId: cycle.id, reviewerId: 'M003', revieweeId: 'M003', type: 'self', status: 'in_progress', answers: [], lastSavedAt: NOW },
  { id: 'sub_self_M004', cycleId: cycle.id, reviewerId: 'M004', revieweeId: 'M004', type: 'self', status: 'not_started', answers: [], lastSavedAt: NOW },
  // downward — admin 이 4명에 대해 평가
  { id: 'sub_dn_M001', cycleId: cycle.id, reviewerId: 'A001', revieweeId: 'M001', type: 'downward', status: 'submitted',   answers: [], lastSavedAt: NOW, reviewerRank: 1 },
  { id: 'sub_dn_M002', cycleId: cycle.id, reviewerId: 'M001', revieweeId: 'M002', type: 'downward', status: 'in_progress', answers: [], lastSavedAt: NOW, reviewerRank: 1 },
  { id: 'sub_dn_M003', cycleId: cycle.id, reviewerId: 'A001', revieweeId: 'M003', type: 'downward', status: 'not_started', answers: [], lastSavedAt: NOW, reviewerRank: 1 },
  { id: 'sub_dn_M004', cycleId: cycle.id, reviewerId: 'A001', revieweeId: 'M004', type: 'downward', status: 'not_started', answers: [], lastSavedAt: NOW, reviewerRank: 1 },
  // 받은리뷰 화면용 — admin 이 받은 리뷰 (closed cycle)
  { id: 'sub_received_admin', cycleId: archivedCycle.id, reviewerId: 'M001', revieweeId: 'A001', type: 'upward', status: 'submitted', answers: [], lastSavedAt: '2026-01-30T00:00:00.000Z' },
];

const seedAuth = { state: { currentUser: adminUser, impersonatingFromId: null, originalUser: null, activeImpersonationLogId: null }, version: 0 };
const seedTeam = { state: {
  users, orgUnits, secondaryOrgs: [], reviewerAssignments: [], orgSnapshots: [],
  permissionGroups: [],  // ensureSystemPermissionGroups 가 onRehydrate 에서 자동 시드
  schemaVersion: 0,
  teams: [],
}, version: 0 };
const seedReview = { state: {
  cycles: [cycle, archivedCycle],
  templates: [defaultTemplate, customTemplate],
  submissions,
}, version: 0 };

// scriptUrl 비워둠 → setup mode 회피 + sync 시도 X
const seedSheets = { state: { scriptUrl: '', sheetId: '', clientId: '', loading: { fingerprint: null, full: null }, lastSyncAt: null, pendingOps: [], errors: [] }, version: 0 };

// ─── CAPTURE SCRIPT ────────────────────────────────────────────────────

async function capture(page, name, options = {}) {
  const out = path.join(OUT_DIR, name);
  await page.waitForTimeout(500);  // 애니메이션 안정화
  if (options.selector) {
    const el = await page.$(options.selector);
    if (el) {
      await el.screenshot({ path: out });
      console.log(`  ✓ ${name}  (${options.selector})`);
      return;
    }
  }
  await page.screenshot({ path: out, fullPage: false });
  console.log(`  ✓ ${name}`);
}

async function gotoAndWait(page, url, waitFor) {
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
  // fetch 차단으로 인한 sync 실패 배너/토스트 강제 제거
  await page.evaluate(() => {
    // Toast container (fixed top-4)
    document.querySelectorAll('div').forEach(el => {
      const cls = (typeof el.className === 'string' ? el.className : '').toString();
      // 토스트
      if (cls.includes('fixed') && cls.includes('top-4') && cls.includes('z-[100]')) el.remove();
      // SyncStatusBanner — border-b + bg-{tone}-005 + text-xs
      if (cls.includes('border-b') && cls.includes('text-xs') &&
          (cls.includes('bg-orange') || cls.includes('bg-yellow') || cls.includes('bg-red'))) el.remove();
    });
  });
  await page.waitForTimeout(200);
}

(async () => {
  console.log('▶ launching chromium (headless, 1440x900, DPR 2)');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });

  // .env 의 VITE_APPS_SCRIPT_URL 이 디폴트로 fetch 를 트리거 → 시드를 덮어씀.
  // 외부 API + dev 서버 자체의 /api/* 프록시 (Vercel Edge 함수) 까지 차단.
  await ctx.route('**/script.google.com/**',     route => route.abort());
  await ctx.route('**/oauth2.googleapis.com/**', route => route.abort());
  await ctx.route('**/accounts.google.com/**',   route => route.abort());
  await ctx.route('**/api/**',                   route => route.abort());
  await ctx.route('**/org-sync*',                route => route.abort());
  await ctx.route('**/review-sync*',             route => route.abort());

  const page = await ctx.newPage();

  // 첫 페이지 진입 → localStorage 직접 set → 새로고침 (Zustand persist 가 그 값으로 hydrate)
  console.log('▶ seeding localStorage...');
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ auth, team, review, sheets }) => {
    localStorage.clear();
    localStorage.setItem('review-auth', JSON.stringify(auth));
    localStorage.setItem('team-data-v2', JSON.stringify(team));
    localStorage.setItem('review-data-v3', JSON.stringify(review));
    localStorage.setItem('sheets-sync-config', JSON.stringify(sheets));
  }, { auth: seedAuth, team: seedTeam, review: seedReview, sheets: seedSheets });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  console.log('▶ /templates — 01-template-list');
  await gotoAndWait(page, '/templates', 'h1, h2, [class*="text-2xl"]');
  await capture(page, '01-template-list.png');

  console.log('▶ /templates/tpl_engineering — 02-template-builder-empty (custom template 빌더 진입)');
  await gotoAndWait(page, '/templates/tpl_engineering', 'h1, h2');
  await capture(page, '02-template-builder-empty.png');

  console.log('▶ /templates/tpl_default — 03-template-sections (3 섹션 + 6 질문)');
  await gotoAndWait(page, '/templates/tpl_default', 'h1, h2');
  await capture(page, '03-template-sections.png');

  console.log('▶ /cycles/new — 10-cycle-new');
  await gotoAndWait(page, '/cycles/new', 'h1, h2');
  await capture(page, '10-cycle-new.png');

  console.log('▶ /cycles/new — 11-cycle-targets (스크롤 down)');
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(300);
  await capture(page, '11-cycle-targets.png');

  // 12-preflight: 스킵 — 발행 시도 → 모달 인터랙션 필요. 빈 폼으로는 차단되거나 유효하지 않아 별도 스크립트 필요
  console.log('▶ /cycles/new — 12-preflight (스킵: 모달 인터랙션 필요)');

  console.log('▶ /cycles/cyc_2026_q1 — 20-cycle-detail');
  await gotoAndWait(page, '/cycles/cyc_2026_q1', 'h1, h2');
  await capture(page, '20-cycle-detail.png');

  console.log('▶ /cycles/cyc_2026_q1 — 21-cycle-kpi (첫 섹션 영역만)');
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture(page, '21-cycle-kpi.png');

  console.log('▶ /cycles/cyc_2026_q1 — 22-ops-center (스크롤 down)');
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(300);
  await capture(page, '22-ops-center.png');

  console.log('▶ /cycles/cyc_2026_q1 — 30-cycle-close (우상단 액션 영역)');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await capture(page, '30-cycle-close.png');

  console.log('▶ /reviews/received — 31-received');
  await gotoAndWait(page, '/reviews/received', 'h1, h2');
  await capture(page, '31-received.png');

  console.log('▶ /cycles/archive — 32-archive');
  await gotoAndWait(page, '/cycles/archive', 'h1, h2');
  await capture(page, '32-archive.png');

  await browser.close();
  console.log('\n✓ DONE — 11/12 captured (12-preflight 은 별도 인터랙션 필요)');
  console.log(`  결과: ${OUT_DIR}`);
})();
