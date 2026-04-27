/**
 * Google Sheets ↔ 조직 데이터 동기화 훅
 * - 구성원(전체 탭 집계) + 조직구조(_조직구조 탭) + 겸임(_겸임 탭) 병렬 조회
 * - ETag 기반 조건부 조회: 시트 변경이 없으면 파싱/렌더 스킵
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

async function fetchTab(action: string, etag?: string): Promise<SheetResponse> {
  const qs = etag ? `action=${action}&etag=${encodeURIComponent(etag)}` : `action=${action}`;
  const res = await fetch(`/api/org-sync?${qs}`, { headers: getScriptHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: SheetResponse = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

export function useOrgSync() {
  const { scriptUrl, orgSyncEnabled, setOrgLastSyncedAt, setOrgSyncError } = useSheetsSyncStore();
  const { syncFromSheet, setLoading } = useTeamStore();
  const orgEtagRef = useRef<string | undefined>(undefined);

  const fetchAndSync = useCallback(async () => {
    setLoading(true);
    setOrgSyncError(null);
    try {
      const [orgResp, orgUnitRows, secondaryOrgRows, assignmentRows, snapshotRows, permissionGroupRows] = await Promise.all([
        fetchTab('getOrg', orgEtagRef.current),
        fetchTab('getOrgStructure').then(r => r.rows ?? r.users ?? []).catch(() => [] as Record<string, unknown>[]),
        fetchTab('getSecondaryOrgs').then(r => r.rows ?? r.users ?? []).catch(() => [] as Record<string, unknown>[]),
        // R1: 평가권/스냅샷 — Apps Script 미배포 시 빈 배열로 폴백
        fetchTab('getAssignments').then(r => r.rows ?? []).catch(() => [] as Record<string, unknown>[]),
        fetchTab('getSnapshots').then(r => r.rows ?? []).catch(() => [] as Record<string, unknown>[]),
        // R6: 권한 그룹 — Apps Script 미배포 시 빈 배열
        fetchTab('getPermissionGroups').then(r => r.rows ?? []).catch(() => [] as Record<string, unknown>[]),
      ]);

      const orgUnits     = parseOrgUnits(orgUnitRows as Record<string, unknown>[]);
      const secondary    = parseSecondaryOrgs(secondaryOrgRows as Record<string, unknown>[]);
      const assignments  = parseReviewerAssignments(assignmentRows as Record<string, unknown>[]);
      const snapshots    = parseOrgSnapshots(snapshotRows as Record<string, unknown>[]);
      const groups       = parsePermissionGroups(permissionGroupRows as Record<string, unknown>[]);

      if (orgResp.unchanged) {
        // 시트 변경 없음 — 파싱·렌더 스킵, 조직구조/겸임/평가권/스냅샷/권한그룹만 갱신
        syncFromSheet(
          useTeamStore.getState().users,
          orgUnits,
          secondary,
          assignments,
          snapshots,
          groups,
        );
      } else {
        if (orgResp.etag) orgEtagRef.current = orgResp.etag;
        const parsedUsers = parseSheetUsers(orgResp.rows ?? orgResp.users ?? []);
        // 시트가 비어 있으면 로컬 데이터 보존
        if (parsedUsers.length === 0) return;
        syncFromSheet(parsedUsers, orgUnits, secondary, assignments, snapshots, groups);
      }

      setOrgLastSyncedAt(new Date().toISOString());
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
