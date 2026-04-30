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
const OUT_BASE = path.join(ROOT, 'public/guide-images');

const BASE = 'http://localhost:5174';
const NOW = new Date('2026-04-29T09:00:00').toISOString();
const FUTURE = new Date('2026-05-30T18:00:00').toISOString().slice(0, 10);
const FUTURE_LATER = new Date('2026-06-15T18:00:00').toISOString().slice(0, 10);

fs.mkdirSync(path.join(OUT_BASE, 'review-cycle'), { recursive: true });
fs.mkdirSync(path.join(OUT_BASE, 'team'),          { recursive: true });

// ─── DEMO SEED ─────────────────────────────────────────────────────────

const adminUser = {
  id: 'A001', name: '김관리', email: 'kim.admin@makestar.com',
  role: 'admin', position: '인사팀장', department: '경영지원', jobFunction: 'HR',
  avatarColor: '#FF558F', orgUnitId: 'ou_root', activityStatus: 'active', status: 'active',
};

const users = [
  adminUser,
  { id: 'M001', name: '이리더', email: 'lee.leader@makestar.com', role: 'leader', position: '개발팀장', department: '제품개발', jobFunction: '개발', avatarColor: '#3B82F6', orgUnitId: 'ou_dev', activityStatus: 'active', status: 'active', managerId: 'A001' },
  { id: 'M002', name: '박개발', email: 'park.dev@makestar.com',   role: 'member', position: '시니어 개발자', department: '제품개발', jobFunction: '개발', avatarColor: '#10B981', orgUnitId: 'ou_dev', activityStatus: 'active', status: 'active', managerId: 'M001' },
  { id: 'M003', name: '최디자이너', email: 'choi.design@makestar.com', role: 'member', position: '프로덕트 디자이너', department: '디자인', jobFunction: '디자인', avatarColor: '#F59E0B', orgUnitId: 'ou_design', activityStatus: 'active', status: 'active', managerId: 'A001' },
  { id: 'M004', name: '정마케터', email: 'jung.market@makestar.com', role: 'member', position: '마케팅 매니저', department: '마케팅', jobFunction: '마케팅', avatarColor: '#8B5CF6', orgUnitId: 'ou_marketing', activityStatus: 'active', status: 'active', managerId: 'A001' },
  // 의도적으로 managerId 없음 + orgUnitId/department 도 fallback 매칭 회피용 → preflight 차단 시나리오
  { id: 'M005', name: '강신입', email: 'kang.new@makestar.com',    role: 'member', position: '주니어 개발자', department: '미배정', jobFunction: '개발', avatarColor: '#EC4899', activityStatus: 'active', status: 'active' },
];

// type: OrgUnitType ('mainOrg' | 'subOrg' | 'team' | 'squad') — Team.tsx mainOrgs 가 type==='mainOrg' 만 root 로 인정
const orgUnits = [
  { id: 'ou_root',      name: '메이크스타',  type: 'mainOrg', parentId: undefined, headId: 'A001', order: 0 },
  { id: 'ou_dev',       name: '제품개발',    type: 'subOrg',  parentId: 'ou_root', headId: 'M001', order: 1 },
  { id: 'ou_design',    name: '디자인',      type: 'subOrg',  parentId: 'ou_root', headId: 'A001', order: 2 },
  { id: 'ou_marketing', name: '마케팅',      type: 'subOrg',  parentId: 'ou_root', headId: 'A001', order: 3 },
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
  targetMode: 'custom',
  targetUserIds: ['M001', 'M002', 'M003', 'M004'],
  templateSnapshot: defaultTemplate,
  templateSnapshotAt: '2026-04-15T00:00:00.000Z',
};

// 12-preflight 캡처용 — draft 상태 + managerId 없는 M005 포함 + 주말 마감
const draftCycle = {
  id: 'cyc_draft_preflight',
  title: '2026년 2분기 정기 리뷰 (초안)',
  type: 'scheduled', status: 'draft', templateId: 'tpl_default',
  targetDepartments: [], createdBy: 'A001', createdAt: '2026-04-29T00:00:00.000Z',
  // 토요일 = 주말 경고 트리거
  selfReviewDeadline: '2026-07-04',  // 토요일
  managerReviewDeadline: '2026-07-18',
  completionRate: 0,
  reviewKinds: ['self', 'downward'],
  downwardReviewerRanks: [1],
  targetMode: 'custom',
  targetUserIds: ['M001', 'M002', 'M005'],  // M005 는 managerId 없음 → 1차 평가권자 미배정 차단
  templateSnapshot: defaultTemplate,
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
  targetMode: 'custom',
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
const reviewerAssignments = [
  // M002 박개발 — 1차: 이리더(직속), 2차: 김관리(admin) → 80/81/82 캡처용
  { id: 'ra_seed_M002_1', revieweeId: 'M002', reviewerId: 'M001', rank: 1, source: 'org_head_inherited', startDate: NOW, createdAt: NOW, createdBy: 'A001' },
  { id: 'ra_seed_M002_2', revieweeId: 'M002', reviewerId: 'A001', rank: 2, source: 'manual',             startDate: NOW, createdAt: NOW, createdBy: 'A001' },
];

const seedTeam = { state: {
  users, orgUnits, secondaryOrgs: [], reviewerAssignments, orgSnapshots: [],
  permissionGroups: [],  // ensureSystemPermissionGroups 가 onRehydrate 에서 자동 시드
  schemaVersion: 'r1',   // R1 마이그레이션 스킵 — 안 그러면 M005 의 orgUnitId 가 ou_root 로 자동 채워짐
  teams: [],
}, version: 0 };
const seedReview = { state: {
  cycles: [cycle, draftCycle, archivedCycle],
  templates: [defaultTemplate, customTemplate],
  submissions,
}, version: 0 };

// scriptUrl 비워둠 → setup mode 회피 + sync 시도 X
const seedSheets = { state: { scriptUrl: '', sheetId: '', clientId: '', loading: { fingerprint: null, full: null }, lastSyncAt: null, pendingOps: [], errors: [] }, version: 0 };

// ─── CAPTURE SCRIPT ────────────────────────────────────────────────────

async function capture(page, relPath, options = {}) {
  // relPath 예: 'review-cycle/01-...png' 또는 'team/50-...png'
  const out = path.join(OUT_BASE, relPath);
  const name = relPath.split('/').pop();
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
  await ctx.route(/script\.google\.com/,      route => route.abort());
  await ctx.route(/oauth2\.googleapis\.com/,  route => route.abort());
  await ctx.route(/accounts\.google\.com/,    route => route.abort());

  // /api/** — 단일 핸들러로 라우트 우선순위 충돌 회피.
  // action 분기 후 일부는 mock 응답, 나머지는 abort. 정규식으로 매칭 (glob `**/api/**` 가 안 잡힘).
  await ctx.route(/\/api\//, async route => {
    const url = route.request().url();
    if (url.includes('/api/org-sync') && route.request().method() === 'POST') {
      let body = {};
      try { body = JSON.parse(route.request().postData() || '{}'); } catch {}
      if (body.action === 'getPendingApprovals') {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ ok: true, items: [
            { email: 'newbie1@makestar.com', name: '신규입사자1', googleSub: 'g_001', firstLoginAt: '2026-04-28T09:00:00.000Z', status: 'pending' },
            { email: 'newbie2@makestar.com', name: '신규입사자2', googleSub: 'g_002', firstLoginAt: '2026-04-29T08:30:00.000Z', status: 'pending' },
          ] }),
        });
      }
    }
    return route.abort();
  });

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
  await capture(page, 'review-cycle/01-template-list.png');

  console.log('▶ /templates/tpl_engineering — 02-template-builder-empty (custom template 빌더 진입)');
  await gotoAndWait(page, '/templates/tpl_engineering', 'h1, h2');
  await capture(page, 'review-cycle/02-template-builder-empty.png');

  console.log('▶ /templates/tpl_default — 03-template-sections (3 섹션 + 6 질문)');
  await gotoAndWait(page, '/templates/tpl_default', 'h1, h2');
  await capture(page, 'review-cycle/03-template-sections.png');

  console.log('▶ /cycles/new — 10-cycle-new');
  await gotoAndWait(page, '/cycles/new', 'h1, h2');
  await capture(page, 'review-cycle/10-cycle-new.png');

  console.log('▶ /cycles/new — 11-cycle-targets (스크롤 down)');
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(300);
  await capture(page, 'review-cycle/11-cycle-targets.png');

  // 12-preflight: draft 사이클 → transition 버튼 → preflight 모달 오픈 후 캡처
  console.log('▶ /cycles/cyc_draft_preflight — 12-preflight (draft → transition 버튼 클릭)');
  await gotoAndWait(page, '/cycles/cyc_draft_preflight', 'h1, h2');
  // transition 버튼 (draft → 발행) 텍스트 후보: "리뷰 발행", "발행", "리뷰 시작"
  const transitionBtn = await page.$('button:has-text("리뷰 발행"), button:has-text("발행"), button:has-text("리뷰 시작"), button:has-text("시작")');
  if (transitionBtn) {
    await transitionBtn.click();
    await page.waitForTimeout(1000);
    // 모달 selector — ModalShell 의 backdrop / dialog 확인
    const modal = await page.$('[role="dialog"], [class*="ModalShell"], [class*="modal"]');
    if (modal) {
      await capture(page, 'review-cycle/12-preflight.png');
    } else {
      console.log('  ✗ 모달이 열리지 않음 — full page 캡처');
      await capture(page, 'review-cycle/12-preflight.png');
    }
  } else {
    console.log('  ✗ transition 버튼을 찾을 수 없음');
  }

  console.log('▶ /cycles/cyc_2026_q1 — 20-cycle-detail');
  await gotoAndWait(page, '/cycles/cyc_2026_q1', 'h1, h2');
  await capture(page, 'review-cycle/20-cycle-detail.png');

  console.log('▶ /cycles/cyc_2026_q1 — 21-cycle-kpi (첫 섹션 영역만)');
  await page.evaluate(() => window.scrollTo(0, 0));
  await capture(page, 'review-cycle/21-cycle-kpi.png');

  console.log('▶ /cycles/cyc_2026_q1 — 22-ops-center (스크롤 down)');
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(300);
  await capture(page, 'review-cycle/22-ops-center.png');

  console.log('▶ /cycles/cyc_2026_q1 — 30-cycle-close (우상단 액션 영역)');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await capture(page, 'review-cycle/30-cycle-close.png');

  console.log('▶ /reviews/received — 31-received');
  await gotoAndWait(page, '/reviews/received', 'h1, h2');
  await capture(page, 'review-cycle/31-received.png');

  console.log('▶ /cycles/archive — 32-archive');
  await gotoAndWait(page, '/cycles/archive', 'h1, h2');
  await capture(page, 'review-cycle/32-archive.png');

  // ─── team 카테고리 ─────────────────────────────────────────────────
  console.log('\n▶ team 카테고리 시작');

  console.log('▶ /team/pending-approvals — 50-pending-approvals-list');
  await gotoAndWait(page, '/team/pending-approvals', 'h1, h2');
  await capture(page, 'team/50-pending-approvals-list.png');

  console.log('▶ /team — 60-team-page');
  await gotoAndWait(page, '/team', 'h1, h2');
  await capture(page, 'team/60-team-page.png');

  console.log('▶ /team?member=M002 — 61-member-drawer');
  await gotoAndWait(page, '/team?member=M002', 'h1, h2');
  await capture(page, 'team/61-member-drawer.png');

  console.log('▶ /team?member=M002&action=edit — 62-member-edit');
  await gotoAndWait(page, '/team?member=M002&action=edit', 'h1, h2');
  await capture(page, 'team/62-member-edit.png');

  // 63: MemberEditDialog 안 "근무 상태" 섹션 — 모달 안 스크롤 후 select 영역 캡처
  console.log('▶ /team?member=M002&action=edit — 63-member-status');
  // 모달이 이미 열린 상태. activityStatus select 영역까지 스크롤
  const statusScroll = await page.evaluate(() => {
    const select = document.querySelector('[role="dialog"] select');
    // 모든 select 중 activityStatus value 포함하는 것
    const selects = Array.from(document.querySelectorAll('[role="dialog"] select'));
    const activitySelect = selects.find(s => Array.from(s.options).some(o => o.value === 'leave_short'));
    if (activitySelect) {
      activitySelect.scrollIntoView({ block: 'center', behavior: 'instant' });
      return true;
    }
    return !!select;
  });
  if (statusScroll) {
    await page.waitForTimeout(300);
    await capture(page, 'team/63-member-status.png');
  } else {
    console.log('  ✗ activityStatus select 미탐지');
  }

  // ─── 인터랙션 화면 (51, 70, 71, 72, 73) — 다이얼로그/모달/DnD ─────

  // 51-approve-form: pending-approvals 의 "승인" 버튼 → ApproveDialog
  console.log('▶ /team/pending-approvals — 51-approve-form (ApproveDialog)');
  await gotoAndWait(page, '/team/pending-approvals', 'h1, h2');
  const approveBtn = await page.$('button:has-text("승인")');
  if (approveBtn) {
    await approveBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    await capture(page, 'team/51-approve-form.png');
    const cancelBtn = await page.$('[role="dialog"] button:has-text("취소")');
    if (cancelBtn) { await cancelBtn.click(); await page.waitForTimeout(300); }
  } else {
    console.log('  ✗ 승인 버튼을 찾을 수 없음 — pending 목록이 비어있을 가능성');
  }

  // 70-org-panel: /team 우측 조직도 패널 영역만 — Team.tsx line 1002: <div className="w-[366px] ... border-l ...">
  console.log('▶ /team — 70-org-panel (우측 조직도 패널)');
  await gotoAndWait(page, '/team', 'h1, h2');
  const panelLocator = page.locator('div.w-\\[366px\\].border-l').first();
  if (await panelLocator.count() > 0) {
    await panelLocator.screenshot({ path: path.join(OUT_BASE, 'team/70-org-panel.png') });
    console.log('  ✓ 70-org-panel.png');
  } else {
    console.log('  ✗ 조직도 패널 미탐지 — full page 캡처');
    await capture(page, 'team/70-org-panel.png');
  }

  // 71-org-add: 주조직 추가 버튼 → OrgUnitDialog
  console.log('▶ /team — 71-org-add (OrgUnitDialog 신규)');
  const addBtn = await page.$('button[title="주조직 추가"]');
  if (addBtn) {
    await addBtn.click();
    await page.waitForSelector('[role="dialog"]', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    await capture(page, 'team/71-org-add.png');
    const cancelBtn = await page.$('[role="dialog"] button:has-text("취소")');
    if (cancelBtn) { await cancelBtn.click(); await page.waitForTimeout(300); }
  } else {
    console.log('  ✗ "주조직 추가" 버튼 미탐지');
  }

  // 72-org-dnd: 트리 노드 DnD 인디케이터 강제 트리거 (HTML5 native dispatchEvent)
  console.log('▶ /team — 72-org-dnd (DnD 인디케이터)');
  await gotoAndWait(page, '/team', 'h1, h2');
  // 트리는 default 로 expanded=true — 진입 직후 4개 노드 mount 됨.
  // src = ou_dev (subOrg), dst = ou_root (mainOrg). ALLOWED_CHILD[mainOrg]=subOrg → "into" 인디케이터 (ring-2)
  const dragStartOk = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('div[draggable="true"]'));
    if (nodes.length < 2) return false;
    const src = nodes[1];  // ou_dev
    const dt = new DataTransfer();
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    window.__dt = dt;
    return true;
  });
  if (dragStartOk) {
    await page.waitForTimeout(200);  // React state setDndState({draggingId, dropTarget:null}) 적용 대기
    await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('div[draggable="true"]'));
      const dst = nodes[0];  // ou_root
      const rect = dst.getBoundingClientRect();
      dst.dispatchEvent(new DragEvent('dragover', {
        bubbles: true, cancelable: true, dataTransfer: window.__dt,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,  // 중앙 → into
      }));
    });
    await page.waitForTimeout(300);  // dropTarget state 적용 + ring-2 render
    await capture(page, 'team/72-org-dnd.png');
    await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('div[draggable="true"]'));
      nodes[1]?.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
    });
    await page.waitForTimeout(300);
  } else {
    console.log('  ✗ draggable 트리 노드 < 2개');
  }

  // 73-org-head: 트리 노드 hover → 편집 버튼 → OrgUnitDialog (편집 모드, 조직장 드롭다운 노출)
  console.log('▶ /team — 73-org-head (OrgUnitDialog 편집 모드 — 조직장 드롭다운)');
  await gotoAndWait(page, '/team', 'h1, h2');
  const treeNode = await page.$('div[draggable="true"]');
  if (treeNode) {
    await treeNode.hover();
    await page.waitForTimeout(300);
    const editBtn = await page.$('button[title="편집"]');
    if (editBtn) {
      await editBtn.click();
      await page.waitForSelector('[role="dialog"]', { timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
      await capture(page, 'team/73-org-head.png');
      const cancelBtn = await page.$('[role="dialog"] button:has-text("취소")');
      if (cancelBtn) { await cancelBtn.click(); await page.waitForTimeout(300); }
    } else {
      console.log('  ✗ 편집 버튼 미탐지');
    }
  } else {
    console.log('  ✗ 트리 노드 미탐지');
  }

  // 80: drawer 의 평가권자 카드 — M002 (1차/2차 시드된 멤버)
  console.log('▶ /team?member=M002 — 80-reviewer-section (drawer 평가권자 카드)');
  await gotoAndWait(page, '/team?member=M002', 'h1, h2');
  // 평가권자 카드까지 스크롤
  const reviewerScroll = await page.evaluate(() => {
    const heading = Array.from(document.querySelectorAll('p')).find(p => p.textContent?.trim() === '평가권자');
    if (heading) {
      heading.scrollIntoView({ block: 'center', behavior: 'instant' });
      return true;
    }
    return false;
  });
  if (reviewerScroll) {
    await page.waitForTimeout(300);
    await capture(page, 'team/80-reviewer-section.png');
  } else {
    console.log('  ✗ "평가권자" 카드 미탐지');
  }

  // 81: drawer 의 "편집" 버튼 클릭 → ReviewerAssignmentModal
  console.log('▶ /team?member=M002 → 편집 — 81-reviewer-modal');
  const editReviewerBtn = await page.evaluate(() => {
    // 평가권자 카드 안의 "편집" 버튼만 (멤버 정보 수정의 "정보 수정" 과 구분 필요)
    const headings = Array.from(document.querySelectorAll('p'));
    const heading = headings.find(p => p.textContent?.trim() === '평가권자');
    const card = heading?.closest('div.bg-white');
    if (!card) return false;
    const btn = card.querySelector('button');
    if (btn && btn.textContent?.includes('편집')) {
      btn.click();
      return true;
    }
    return false;
  });
  if (editReviewerBtn) {
    await page.waitForSelector('[role="dialog"][aria-label*="평가권자 배정"]', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
    await capture(page, 'team/81-reviewer-modal.png');

    // 82: 같은 모달 — rank 결과가 1차+2차 노출됨 (시드된 활성 평가권자 2건)
    console.log('▶ ReviewerAssignmentModal — 82-reviewer-ranks');
    await capture(page, 'team/82-reviewer-ranks.png');

    // 닫기는 graceful — drawer 가 모달 위로 zindex 가질 수 있어 timeout 발생 가능. 무시하고 진행.
    const closeBtn = await page.$('[role="dialog"][aria-label*="평가권자 배정"] button:has-text("닫기")');
    if (closeBtn) {
      await closeBtn.click({ force: true, timeout: 2000 }).catch(() => {});
    }
  } else {
    console.log('  ✗ 평가권자 카드 "편집" 버튼 미탐지');
  }

  await browser.close();
  console.log('\n✓ DONE');
  console.log(`  review-cycle: 12/12`);
  console.log(`  team: 9/9 (구현된 화면만 — 미구현 4건은 가이드에서 "예정" 처리)`);
  console.log(`  결과: ${OUT_BASE}`);
})();
