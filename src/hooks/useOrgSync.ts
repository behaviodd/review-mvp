/**
 * Google Sheets ↔ 조직 데이터 동기화 훅
 *
 * R7 Phase 4: 단일 `bulkGetAll` 호출로 6개 시트를 한 번에 조회.
 *   - 통합 ETag 로 변경 없으면 파싱/렌더 스킵
 *   - Apps Script 측 ScriptCache 5분 TTL — 캐시 적중 시 시트 read 0회
 *   - bulkGetAll 미배포(에러)면 기존 6개 병렬 fetch 로 폴백
 */
import { useEffect, useCallback, useRef } from 'react';
import { useTeamStore } from '../stores/teamStore';
import { useSheetsSyncStore } from '../stores/sheetsSyncStore';
import {
  parseSheetUsers,
  parseOrgUnits,
  parseSecondaryOrgs,
  parseReviewerAssignments,
  parseOrgSnapshots,
  parsePermissionGroups,
} from '../utils/sheetParser';
import { getScriptHeaders } from '../utils/scriptHeaders';
import { resilientFetch, SyncError } from '../utils/resilientFetch';
import { registerOrgRefetch } from '../utils/syncControl';
import { useShowToast } from '../components/ui/Toast';

const POLL_MS = 60_000;
/** 연속 실패 N 회 이상이면 다음 polling 지연을 비례 확대 (cap 8x). */
const BACKOFF_CAP = 8;
/** 최근 쓰기 후 이 시간(ms) 안에는 자동 poll 을 건너뛴다 — Apps Script 의 비동기 쓰기와 다음 GET 의 race 방지. */
const WRITE_GRACE_MS = 4_000;
/** 쓰기 직후 자동으로 한 번 fetch 를 예약하는 지연 — 시트에 반영된 최신값으로 fingerprint 갱신. */
const WRITE_REFRESH_MS = 2_000;

interface SheetResponse {
  rows?: Record<string, unknown>[];
  users?: Record<string, unknown>[];
  etag?: string;
  unchanged?: boolean;
  error?: string;
}

interface BulkResponse {
  ok?: boolean;
  unchanged?: boolean;
  cached?: boolean;
  etag?: string;
  error?: string;
  users?: Record<string, unknown>[];
  orgUnits?: Record<string, unknown>[];
  secondaryOrgs?: Record<string, unknown>[];
  assignments?: Record<string, unknown>[];
  snapshots?: Record<string, unknown>[];
  permissionGroups?: Record<string, unknown>[];
}

async function fetchTab(action: string, etag?: string): Promise<SheetResponse> {
  const qs = etag ? `action=${action}&etag=${encodeURIComponent(etag)}` : `action=${action}`;
  const res = await resilientFetch(`/api/org-sync?${qs}`, { headers: getScriptHeaders() });
  const data: SheetResponse = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function fetchBulk(etag?: string): Promise<BulkResponse> {
  const qs = etag ? `action=bulkGetAll&etag=${encodeURIComponent(etag)}` : 'action=bulkGetAll';
  const res = await resilientFetch(`/api/org-sync?${qs}`, { headers: getScriptHeaders() });
  const data: BulkResponse = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export function useOrgSync() {
  const { scriptUrl, orgSyncEnabled, setOrgLastSyncedAt, setOrgSyncError } = useSheetsSyncStore();
  const { syncFromSheet, setLoading } = useTeamStore();
  const showToast = useShowToast();
  // bulkGetAll 의 통합 ETag (구버전 Apps Script 폴백 시 무시됨)
  const bulkEtagRef = useRef<string | undefined>(undefined);
  // 폴백 경로의 _구성원 단일 ETag
  const orgEtagRef = useRef<string | undefined>(undefined);
  // bulkGetAll 미지원 감지 후 폴백 모드 고정 — 매 호출마다 재시도하지 않음
  const fallbackModeRef = useRef(false);
  // 쓰기 직후 한 번만 발화하는 refresh timer — 중복 예약 방지
  const writeRefreshTimerRef = useRef<number | null>(null);
  // 연속 실패 카운터 — polling 백오프 계산용
  const failuresRef = useRef(0);
  // 직전에 에러가 있었는지 — 복구 토스트 1회 발화용
  const prevErrorRef = useRef<string | null>(null);

  const fetchAndSync = useCallback(async (opts?: { force?: boolean }) => {
    // 최근에 쓴 직후라면 stale 시트 데이터로 로컬 optimistic 상태가 덮이지 않도록 skip.
    if (!opts?.force) {
      const lastWriteAt = useSheetsSyncStore.getState().lastWriteAt;
      if (lastWriteAt && Date.now() - lastWriteAt < WRITE_GRACE_MS) {
        // 후속 refresh 보장 — 쓰기 종료 후 한 번 더 시도
        if (writeRefreshTimerRef.current == null) {
          writeRefreshTimerRef.current = window.setTimeout(() => {
            writeRefreshTimerRef.current = null;
            void fetchAndSync({ force: true });
          }, WRITE_REFRESH_MS);
        }
        return;
      }
    }

    setLoading(true);
    setOrgSyncError(null);
    const t0 = performance.now();

    const markSuccess = () => {
      setOrgLastSyncedAt(new Date().toISOString());
      failuresRef.current = 0;
      if (prevErrorRef.current) {
        showToast('success', '조직 동기화가 복구되었어요');
        prevErrorRef.current = null;
      }
    };

    try {
      // 1) bulkGetAll 우선 시도
      if (!fallbackModeRef.current) {
        try {
          const bulk = await fetchBulk(bulkEtagRef.current);
          if (bulk.unchanged) {
            // 변경 없음 — 파싱/렌더 스킵
            markSuccess();
            console.info(`[OrgSync] bulk unchanged ${(performance.now() - t0).toFixed(0)}ms${bulk.cached ? ' (cached)' : ''}`);
            return;
          }
          if (bulk.etag) bulkEtagRef.current = bulk.etag;
          const parsedUsers = parseSheetUsers(bulk.users ?? []);
          if (parsedUsers.length === 0) {
            // 시트가 비어 있으면 로컬 데이터 보존
            console.warn(`[OrgSync] bulk: 시트의 구성원이 비어있습니다. 응답 row=${(bulk.users ?? []).length}, 파싱 후=0`);
            markSuccess();
            return;
          }
          syncFromSheet(
            parsedUsers,
            parseOrgUnits(bulk.orgUnits ?? []),
            parseSecondaryOrgs(bulk.secondaryOrgs ?? []),
            parseReviewerAssignments(bulk.assignments ?? []),
            parseOrgSnapshots(bulk.snapshots ?? []),
            parsePermissionGroups(bulk.permissionGroups ?? []),
          );
          markSuccess();
          console.info(`[OrgSync] bulk fresh ${(performance.now() - t0).toFixed(0)}ms — users=${parsedUsers.length} orgs=${(bulk.orgUnits ?? []).length} permGroups=${(bulk.permissionGroups ?? []).length}`);
          return;
        } catch (e) {
          // bulkGetAll 미지원 — 폴백 모드로 전환 (1회만 로깅)
          const msg = e instanceof Error ? e.message : String(e);
          if (/알 수 없는 action|Unknown action|action.*bulkGetAll/i.test(msg)) {
            fallbackModeRef.current = true;
            console.warn('[OrgSync] bulkGetAll 미지원 — 6개 병렬 fetch 폴백');
          } else {
            throw e;
          }
        }
      }

      // 2) 폴백: 기존 6개 병렬 fetch
      const [orgResp, orgUnitRows, secondaryOrgRows, assignmentRows, snapshotRows, permissionGroupRows] = await Promise.all([
        fetchTab('getOrg', orgEtagRef.current),
        fetchTab('getOrgStructure').then(r => r.rows ?? r.users ?? []).catch(() => [] as Record<string, unknown>[]),
        fetchTab('getSecondaryOrgs').then(r => r.rows ?? r.users ?? []).catch(() => [] as Record<string, unknown>[]),
        fetchTab('getAssignments').then(r => r.rows ?? []).catch(() => [] as Record<string, unknown>[]),
        fetchTab('getSnapshots').then(r => r.rows ?? []).catch(() => [] as Record<string, unknown>[]),
        fetchTab('getPermissionGroups').then(r => r.rows ?? []).catch(() => [] as Record<string, unknown>[]),
      ]);

      const orgUnits     = parseOrgUnits(orgUnitRows as Record<string, unknown>[]);
      const secondary    = parseSecondaryOrgs(secondaryOrgRows as Record<string, unknown>[]);
      const assignments  = parseReviewerAssignments(assignmentRows as Record<string, unknown>[]);
      const snapshots    = parseOrgSnapshots(snapshotRows as Record<string, unknown>[]);
      const groups       = parsePermissionGroups(permissionGroupRows as Record<string, unknown>[]);

      if (orgResp.unchanged) {
        syncFromSheet(useTeamStore.getState().users, orgUnits, secondary, assignments, snapshots, groups);
      } else {
        if (orgResp.etag) orgEtagRef.current = orgResp.etag;
        const parsedUsers = parseSheetUsers(orgResp.rows ?? orgResp.users ?? []);
        if (parsedUsers.length === 0) return;
        syncFromSheet(parsedUsers, orgUnits, secondary, assignments, snapshots, groups);
      }

      markSuccess();
      console.info(`[OrgSync] fallback ${(performance.now() - t0).toFixed(0)}ms — users=${useTeamStore.getState().users.length} orgs=${orgUnits.length}`);
    } catch (e) {
      failuresRef.current += 1;
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      // SyncError 면 kind 직접 사용, 그 외(Apps Script body error 등)는 transient 기본
      const kind = e instanceof SyncError ? e.kind : 'transient';
      setOrgSyncError(msg, kind);
      console.error('[OrgSync]', `failed (#${failuresRef.current}) [${kind}]`, msg);
      // 메시지가 바뀌었거나 첫 발생일 때만 토스트 — polling 반복 동안 동일 에러 스팸 방지
      if (prevErrorRef.current !== msg) {
        showToast('error', `조직 동기화 실패: ${msg}`);
        prevErrorRef.current = msg;
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncFromSheet, setLoading, setOrgLastSyncedAt, setOrgSyncError, scriptUrl]);

  useEffect(() => {
    if (!scriptUrl) return;
    let cancelled = false;
    let timer: number | null = null;
    let inFlight = false;

    const scheduleNext = () => {
      if (cancelled || !orgSyncEnabled) return;
      const f = failuresRef.current;
      // 0~1회 실패: 1x · 2회: 2x · 3회: 4x · 4회+: 8x (cap)
      const mult = Math.min(2 ** Math.max(0, f - 1), BACKOFF_CAP);
      const delay = POLL_MS * mult;
      if (f > 0) console.info(`[OrgSync] next poll in ${(delay / 1000).toFixed(0)}s (failures=${f})`);
      timer = window.setTimeout(tick, delay);
    };

    const tick = async () => {
      if (cancelled) return;
      // 이미 fetch 진행 중이면 중복 발화 방지 (visibility flicker / refetch race)
      if (inFlight) return;
      if (document.hidden) {
        // 숨김 탭 — fetch 스킵, 다음 예약만
        scheduleNext();
        return;
      }
      inFlight = true;
      try {
        await fetchAndSync();
      } finally {
        inFlight = false;
      }
      scheduleNext();
    };

    void tick();

    if (!orgSyncEnabled) {
      return () => {
        cancelled = true;
        if (timer != null) window.clearTimeout(timer);
      };
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !cancelled) {
        // 백그라운드 동안 누적된 timer 취소 후 즉시 재실행
        if (timer != null) {
          window.clearTimeout(timer);
          timer = null;
        }
        void tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchAndSync, orgSyncEnabled, scriptUrl]);

  // 비-훅 위치 (배너 등) 에서 강제 refetch 호출 가능하도록 등록
  useEffect(() => registerOrgRefetch(fetchAndSync), [fetchAndSync]);

  return { refetch: fetchAndSync };
}
