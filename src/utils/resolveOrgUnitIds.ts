/**
 * 런타임 orgUnitId 자동 해석 (안정성 보강, 2026-06-10).
 *
 * `주조직ID`(orgUnitId) 가 비었거나 무효인 구성원을, 이름경로
 * (주조직 > 부조직 > 팀 > 스쿼드) 의 가장 깊은 단계로 조직트리의 노드에 매핑한다.
 * 동명 노드가 여럿이면 상위 경로(조상 이름)로 한정한다.
 *
 * GAS 백필(backfill_orgUnitId)의 클라이언트판. 비파괴적 — 이미 유효한 orgUnitId 는
 * 그대로 두고, 빈/무효인 경우만 채운다. 신규 구성원이 시트에 ID 없이 추가돼도
 * 동기화 시점에 자가복구되도록 하는 안전망.
 *
 * 이름 비교는 orgNameKey(NFC + 공백제거 + 소문자)로 — NFD·띄어쓰기 typo 흡수.
 */

import type { OrgUnit, User } from '../types';
import { orgNameKey } from './normalizeOrgName';

export interface ResolveOrgUnitIdsResult {
  /** orgUnitId 가 채워진 사용자 목록(원본 보존, 빈/무효만 변경). */
  users: User[];
  /** 끝내 배치하지 못한 사용자(이름경로로도 노드 못 찾음). */
  unresolved: User[];
  /** 이번에 새로 채운 수. */
  filledCount: number;
}

export function resolveOrgUnitIds(users: User[], orgUnits: OrgUnit[]): ResolveOrgUnitIdsResult {
  const validIds = new Set(orgUnits.map(o => o.id));
  const byId = new Map(orgUnits.map(o => [o.id, o]));

  // 이름키 → 노드들(동명 가능)
  const byNameKey = new Map<string, OrgUnit[]>();
  for (const o of orgUnits) {
    const k = orgNameKey(o.name);
    if (!k) continue;
    const arr = byNameKey.get(k);
    if (arr) arr.push(o);
    else byNameKey.set(k, [o]);
  }

  const ancestorKeys = (id: string): Set<string> => {
    const set = new Set<string>();
    let cursor = byId.get(id);
    let guard = 0;
    while (cursor?.parentId && byId.has(cursor.parentId) && guard < 20) {
      cursor = byId.get(cursor.parentId)!;
      set.add(orgNameKey(cursor.name));
      guard += 1;
    }
    return set;
  };

  const unresolved: User[] = [];
  let filledCount = 0;

  const nextUsers = users.map(user => {
    // 이미 유효한 ID 면 그대로
    if (user.orgUnitId && validIds.has(user.orgUnitId)) return user;

    const path = [user.department, user.subOrg, user.team, user.squad].map(orgNameKey);
    let deep = -1;
    for (let i = 0; i < 4; i += 1) if (path[i]) deep = i;
    if (deep < 0) { unresolved.push(user); return user; }

    const cands = byNameKey.get(path[deep]) ?? [];
    let chosen: OrgUnit | undefined;
    if (cands.length === 1) {
      chosen = cands[0];
    } else if (cands.length > 1) {
      const higher = path.slice(0, deep).filter(Boolean);
      const ok = cands.filter(n => {
        const anc = ancestorKeys(n.id);
        return higher.every(h => anc.has(h));
      });
      if (ok.length === 1) chosen = ok[0];
    }

    if (!chosen) { unresolved.push(user); return user; }
    filledCount += 1;
    return { ...user, orgUnitId: chosen.id };
  });

  return { users: nextUsers, unresolved, filledCount };
}
