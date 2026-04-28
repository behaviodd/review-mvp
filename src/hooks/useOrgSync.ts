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

const POLL_MS = 60_000;

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
  const res = await fetch(`/api/org-sync?${qs}`, { headers: getScriptHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: SheetResponse = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function fetchBulk(etag?: string): Promise<BulkResponse> {
  const qs = etag ? `action=bulkGetAll&etag=${encodeURIComponent(etag)}` : 'action=bulkGetAll';
  const res = await fetch(`/api/org-sync?${qs}`, { headers: getScriptHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: BulkResponse = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export function useOrgSync() {
  const { scriptUrl, orgSyncEnabled, setOrgLastSyncedAt, setOrgSyncError } = useSheetsSyncStore();
  const { syncFromSheet, setLoading } = useTeamStore();
  // bulkGetAll 의 통합 ETag (구버전 Apps Script 폴백 시 무시됨)
  const bulkEtagRef = useRef<string | undefined>(undefined);
  // 폴백 경로의 _구성원 단일 ETag
  const orgEtagRef = useRef<string | undefined>(undefined);
  // bulkGetAll 미지원 감지 후 폴백 모드 고정 — 매 호출마다 재시도하지 않음
  const fallbackModeRef = useRef(false);

  const fetchAndSync = useCallback(async () => {
    setLoading(true);
    setOrgSyncError(null);
    const t0 = performance.now();
    try {
      // 1) bulkGetAll 우선 시도
      if (!fallbackModeRef.current) {
        try {
          const bulk = await fetchBulk(bulkEtagRef.current);
          if (bulk.unchanged) {
            // 변경 없음 — 파싱/렌더 스킵
            setOrgLastSyncedAt(new Date().toISOString());
            console.info(`[OrgSync] bulk unchanged ${(performance.now() - t0).toFixed(0)}ms${bulk.cached ? ' (cached)' : ''}`);
            return;
          }
          if (bulk.etag) bulkEtagRef.current = bulk.etag;
          const parsedUsers = parseSheetUsers(bulk.users ?? []);
          if (parsedUsers.length === 0) {
            // 시트가 비어 있으면 로컬 데이터 보존
            console.warn(`[OrgSync] bulk: 시트의 구성원이 비어있습니다. 응답 row=${(bulk.users ?? []).length}, 파싱 후=0`);
            setOrgLastSyncedAt(new Date().toISOString());
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
          setOrgLastSyncedAt(new Date().toISOString());
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

      setOrgLastSyncedAt(new Date().toISOString());
      console.info(`[OrgSync] fallback ${(performance.now() - t0).toFixed(0)}ms — users=${useTeamStore.getState().users.length} orgs=${orgUnits.length}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      setOrgSyncError(msg);
      console.error('[OrgSync]', msg);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncFromSheet, setLoading, setOrgLastSyncedAt, setOrgSyncError, scriptUrl]);

  useEffect(() => {
    if (!scriptUrl) return;
    fetchAndSync();
    if (!orgSyncEnabled) return;

    const interval = setInterval(fetchAndSync, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchAndSync();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [fetchAndSync, orgSyncEnabled]);

  return { refetch: fetchAndSync };
}
