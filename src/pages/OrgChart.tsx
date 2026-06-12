import { useMemo, useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useTeamStore } from '../stores/teamStore';
import { useSetPageHeader } from '../contexts/PageHeaderContext';
import { isUserActive, getMembersInOrgTree } from '../utils/userCompat';
import { orgNameEquals } from '../utils/normalizeOrgName';
import { UserAvatar } from '../components/ui/UserAvatar';
import { HeaderTab } from '../components/layout/HeaderTab';
import { TeamViewToggle } from '../components/team/TeamViewToggle';
import { MsSearchIcon, MsCancelIcon } from '../components/ui/MsIcons';
import { MsInput } from '../components/ui/MsControl';
import { Users, ChevronDown, ChevronUp, Plus, Minus, Maximize2 } from 'lucide-react';
import type { OrgUnit, OrgUnitType, User } from '../types';

/* ── 레이아웃 상수 ──────────────────────────────────────────────────── */
const NODE_W = 224;
const NODE_H = 96;
const H_GAP = 28;   // 형제 간 가로 간격
const V_GAP = 56;   // 레벨 간 세로 간격
const PAD = 48;     // 캔버스 여백
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2;

/* ── 인원 카운트 (Team.tsx OrgTreeNode.memberCount 와 동일 규칙) ────────
 * 토글로 리스트/차트를 비교했을 때 인원수가 어긋나지 않도록 같은 로직 유지. */
const LEGACY_KEY: Record<OrgUnitType, keyof User> = {
  mainOrg: 'department', subOrg: 'subOrg', team: 'team', squad: 'squad',
};

interface Pos { x: number; y: number; }
interface Node {
  unit: OrgUnit;
  depth: number;
  pos: Pos;
  hasChildren: boolean;     // 실제(접힘 무관) 직속 하위 존재
  childCount: number;       // 직속 하위 조직 수
  collapsed: boolean;
  direct: number;           // 직속 인원
  total: number;            // 총원(하위 포함)
  head?: User;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function OrgChart() {
  const { users, orgUnits, secondaryOrgs } = useTeamStore();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pos>({ x: PAD, y: PAD });
  const viewportRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom); zoomRef.current = zoom;
  const panRef = useRef(pan); panRef.current = pan;
  const didInitFit = useRef(false);

  const unitById = useMemo(() => new Map(orgUnits.map(u => [u.id, u])), [orgUnits]);
  const userById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const childrenOf = useMemo(() => {
    const map = new Map<string | undefined, OrgUnit[]>();
    for (const u of orgUnits) {
      const parentKey = u.parentId && unitById.has(u.parentId) ? u.parentId : undefined;
      const arr = map.get(parentKey) ?? [];
      arr.push(u);
      map.set(parentKey, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.order - b.order);
    return map;
  }, [orgUnits, unitById]);

  const totalCountOf = useCallback((unit: OrgUnit): number => {
    const set = new Set(
      getMembersInOrgTree(unit.id, users, orgUnits).filter(isUserActive).map(u => u.id),
    );
    users
      .filter(u => orgNameEquals(u[LEGACY_KEY[unit.type]] as string | undefined, unit.name) && isUserActive(u))
      .forEach(u => set.add(u.id));
    const secExtra = secondaryOrgs.filter(a => a.orgId === unit.id && !set.has(a.userId)).length;
    return set.size + secExtra;
  }, [users, orgUnits, secondaryOrgs]);

  const directCountOf = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) {
      if (u.orgUnitId && isUserActive(u)) counts.set(u.orgUnitId, (counts.get(u.orgUnitId) ?? 0) + 1);
    }
    return counts;
  }, [users]);

  // 검색 매칭 + 조상 강제 펼침
  const { matchedIds, forceExpand } = useMemo(() => {
    const q = search.trim().normalize('NFC').toLowerCase();
    if (!q) return { matchedIds: null as Set<string> | null, forceExpand: new Set<string>() };
    const matched = new Set<string>();
    const expand = new Set<string>();
    for (const u of orgUnits) {
      if (u.name.normalize('NFC').toLowerCase().includes(q)) {
        matched.add(u.id);
        let cur: OrgUnit | undefined = u.parentId ? unitById.get(u.parentId) : undefined;
        const seen = new Set<string>();
        while (cur && !seen.has(cur.id)) { seen.add(cur.id); expand.add(cur.id); cur = cur.parentId ? unitById.get(cur.parentId) : undefined; }
      }
    }
    return { matchedIds: matched, forceExpand: expand };
  }, [search, orgUnits, unitById]);

  /* ── 트리 레이아웃 (상하, 부모는 자식 중앙 정렬) ──────────────────── */
  const { nodes, bounds, positions } = useMemo(() => {
    const out: Node[] = [];
    const positions = new Map<string, Pos>();
    let cursorX = 0;
    let maxDepth = 0;

    const place = (unit: OrgUnit, depth: number): number => {
      maxDepth = Math.max(maxDepth, depth);
      const allKids = childrenOf.get(unit.id) ?? [];
      const isCollapsed = collapsed.has(unit.id) && !forceExpand.has(unit.id);
      const kids = isCollapsed ? [] : allKids;
      const y = depth * (NODE_H + V_GAP);

      let centerX: number;
      if (kids.length === 0) {
        centerX = cursorX + NODE_W / 2;
        cursorX += NODE_W + H_GAP;
      } else {
        const childCenters = kids.map(k => place(k, depth + 1));
        centerX = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
      }
      const pos = { x: centerX - NODE_W / 2, y };
      positions.set(unit.id, pos);
      out.push({
        unit, depth, pos,
        hasChildren: allKids.length > 0,
        childCount: allKids.length,
        collapsed: isCollapsed,
        direct: directCountOf.get(unit.id) ?? 0,
        total: totalCountOf(unit),
        head: unit.headId ? userById.get(unit.headId) : undefined,
      });
      return centerX;
    };

    const roots = childrenOf.get(undefined) ?? [];
    for (const r of roots) place(r, 0);

    const w = Math.max(0, cursorX - H_GAP);
    const h = roots.length ? (maxDepth + 1) * NODE_H + maxDepth * V_GAP : 0;
    return { nodes: out, bounds: { w, h }, positions };
  }, [childrenOf, collapsed, forceExpand, directCountOf, totalCountOf, userById]);

  // 연결선 (부모 하단 → 버스 → 각 자식 상단)
  const connectors = useMemo(() => {
    const paths: string[] = [];
    for (const n of nodes) {
      if (n.collapsed || !n.hasChildren) continue;
      const kids = childrenOf.get(n.unit.id) ?? [];
      const kidPos = kids.map(k => positions.get(k.id)).filter(Boolean) as Pos[];
      if (kidPos.length === 0) continue;
      const px = n.pos.x + NODE_W / 2;
      const py = n.pos.y + NODE_H;
      const busY = py + V_GAP / 2;
      const cxs = kidPos.map(p => p.x + NODE_W / 2);
      paths.push(`M ${px} ${py} L ${px} ${busY}`);
      paths.push(`M ${Math.min(...cxs)} ${busY} L ${Math.max(...cxs)} ${busY}`);
      for (const p of kidPos) {
        const cx = p.x + NODE_W / 2;
        paths.push(`M ${cx} ${busY} L ${cx} ${p.y}`);
      }
    }
    return paths;
  }, [nodes, childrenOf, positions]);

  const allParentIds = useMemo(
    () => orgUnits.filter(u => (childrenOf.get(u.id)?.length ?? 0) > 0).map(u => u.id),
    [orgUnits, childrenOf],
  );

  const toggle = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  /* ── 줌/팬 ─────────────────────────────────────────────────────── */
  const fit = useCallback(() => {
    const el = viewportRef.current;
    if (!el || bounds.w <= 0) return;
    const vw = el.clientWidth, vh = el.clientHeight;
    const z = clamp(Math.min((vw - PAD * 2) / bounds.w, (vh - PAD * 2) / bounds.h, 1), MIN_ZOOM, MAX_ZOOM);
    setZoom(z);
    setPan({ x: (vw - bounds.w * z) / 2, y: PAD });
  }, [bounds.w, bounds.h]);

  // 최초 1회 화면 맞춤
  useLayoutEffect(() => {
    if (!didInitFit.current && bounds.w > 0) { didInitFit.current = true; fit(); }
  }, [bounds.w, fit]);

  // 휠 줌 (커서 기준) — non-passive 리스너로 preventDefault
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const z = zoomRef.current, p = panRef.current;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const nz = clamp(z * factor, MIN_ZOOM, MAX_ZOOM);
      if (nz === z) return;
      setPan({ x: cx - (cx - p.x) * (nz / z), y: cy - (cy - p.y) * (nz / z) });
      setZoom(nz);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // 배경 드래그 팬 (버튼/배지 위에서는 시작 안 함)
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const start = { mx: e.clientX, my: e.clientY, px: panRef.current.x, py: panRef.current.y };
    const move = (ev: MouseEvent) => setPan({ x: start.px + (ev.clientX - start.mx), y: start.py + (ev.clientY - start.my) });
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const zoomBy = (factor: number) => {
    const el = viewportRef.current;
    const z = zoomRef.current, p = panRef.current;
    const nz = clamp(z * factor, MIN_ZOOM, MAX_ZOOM);
    if (!el || nz === z) { setZoom(nz); return; }
    const cx = el.clientWidth / 2, cy = el.clientHeight / 2;
    setPan({ x: cx - (cx - p.x) * (nz / z), y: cy - (cy - p.y) * (nz / z) });
    setZoom(nz);
  };

  // 검색 시 첫 매칭으로 화면 이동
  useEffect(() => {
    if (!matchedIds || matchedIds.size === 0) return;
    const el = viewportRef.current;
    if (!el) return;
    const firstId = orgUnits.find(u => matchedIds.has(u.id))?.id;
    const p = firstId ? positions.get(firstId) : undefined;
    if (!p) return;
    const z = zoomRef.current;
    setPan({ x: el.clientWidth / 2 - (p.x + NODE_W / 2) * z, y: el.clientHeight / 3 - (p.y + NODE_H / 2) * z });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, matchedIds, positions]);

  /* ── 헤더 ──────────────────────────────────────────────────────── */
  const headerActions = useMemo(() => (
    <MsInput
      type="text"
      value={search}
      onChange={e => setSearch(e.target.value)}
      placeholder="조직명 검색"
      leftSlot={<MsSearchIcon size={16} />}
      rightSlot={search ? (
        <button onClick={() => setSearch('')} className="text-fg-subtle hover:text-fg-default" aria-label="검색 지우기">
          <MsCancelIcon size={14} />
        </button>
      ) : undefined}
      className="w-64 md:w-72 h-10"
    />
  ), [search]);

  const tabActions = useMemo(() => (
    <>
      <TeamViewToggle current="chart" />
      <span className="w-px h-4 bg-bd-default mx-0.5" aria-hidden />
      <button
        onClick={() => setCollapsed(new Set())}
        className="inline-flex items-center h-6 px-2 text-xs font-bold rounded-md border border-bd-primary text-fg-default hover:bg-interaction-hovered transition-colors"
      >
        모두 펼치기
      </button>
      <button
        onClick={() => setCollapsed(new Set(allParentIds))}
        className="inline-flex items-center h-6 px-2 text-xs font-bold rounded-md border border-bd-primary text-fg-default hover:bg-interaction-hovered transition-colors"
      >
        모두 접기
      </button>
    </>
  ), [allParentIds]);

  const headerTabs = useMemo(() => <HeaderTab active>조직도</HeaderTab>, []);

  useSetPageHeader('구성원', headerActions, { tabs: headerTabs, tabActions });

  const emptyOrgs = orgUnits.length === 0;

  return (
    <div className="h-full flex flex-col">
      {/* 캔버스 */}
      <div
        ref={viewportRef}
        onMouseDown={onMouseDown}
        className="relative flex-1 overflow-hidden bg-surface-sunken cursor-grab active:cursor-grabbing select-none"
      >
        {emptyOrgs ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-fg-subtle gap-1">
            <p className="text-base font-semibold">등록된 조직이 없습니다</p>
            <p className="text-sm">리스트 보기에서 조직을 추가해 주세요.</p>
          </div>
        ) : (
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, width: bounds.w, height: bounds.h }}
          >
            {/* 연결선 */}
            <svg
              className="absolute top-0 left-0 pointer-events-none overflow-visible"
              width={bounds.w} height={bounds.h}
            >
              {connectors.map((d, i) => (
                <path key={i} d={d} stroke="#cbd2d9" strokeWidth={1.5} fill="none" />
              ))}
            </svg>

            {/* 노드 카드 */}
            {nodes.map(n => {
              const matched = matchedIds?.has(n.unit.id);
              const dim = matchedIds && !matched;
              return (
                <div
                  key={n.unit.id}
                  className="absolute"
                  style={{ left: n.pos.x, top: n.pos.y, width: NODE_W, height: NODE_H }}
                >
                  <div
                    className={`relative h-full rounded-xl border bg-surface-default px-3.5 py-2.5 shadow-[0_1px_3px_rgba(76,90,102,0.10)] flex flex-col justify-center gap-1 transition-opacity ${
                      matched ? 'border-fg-brand1 ring-2 ring-fg-brand1/30' : 'border-bd-default'
                    } ${dim ? 'opacity-40' : ''}`}
                  >
                    {/* 조직명 */}
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`truncate text-base tracking-[-0.3px] ${n.depth === 0 ? 'font-bold' : 'font-semibold'} ${n.unit.isDerived ? 'text-fg-subtle' : 'text-fg-default'}`}>
                        {n.unit.name}
                      </span>
                      {n.unit.isDerived && (
                        <span className="flex-shrink-0 text-[10px] font-semibold text-fg-subtlest bg-gray-010 px-1 py-0.5 rounded" title="_조직구조에 등록하면 정식 조직이 됩니다">
                          자동
                        </span>
                      )}
                    </div>

                    {/* 조직장 */}
                    <div className="flex items-center gap-1.5 min-w-0 h-5">
                      {n.head ? (
                        <>
                          <UserAvatar user={n.head} className="size-5 text-[10px]" />
                          <span className="truncate text-xs text-fg-subtle">{n.head.name}</span>
                        </>
                      ) : (
                        <span className="text-xs text-fg-subtlest">조직장 미지정</span>
                      )}
                    </div>

                    {/* 인원 */}
                    <div className="flex items-center gap-2 text-xs text-fg-subtle">
                      <span className="inline-flex items-center gap-1 tabular-nums" title="총원(하위 포함)">
                        <Users size={12} /> {n.total}
                      </span>
                      <span className="text-fg-subtlest">·</span>
                      <span className="tabular-nums" title="직속 인원">직속 {n.direct}</span>
                    </div>

                    {/* 하위 조직 수 배지 (펼침/접기) */}
                    {n.hasChildren && (
                      <button
                        onClick={() => toggle(n.unit.id)}
                        className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-0.5 h-5 pl-2 pr-1.5 rounded-full bg-green-040 text-white text-[11px] font-bold shadow-sm hover:brightness-95 transition"
                        title={n.collapsed ? `하위 ${n.childCount}개 펼치기` : '접기'}
                      >
                        {n.childCount}
                        {n.collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 줌 컨트롤 */}
        {!emptyOrgs && (
          <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-lg border border-bd-default bg-surface-default shadow-md px-1.5 py-1">
            <button onClick={fit} className="p-1.5 rounded-md text-fg-subtle hover:text-fg-default hover:bg-interaction-hovered transition-colors" title="화면 맞춤">
              <Maximize2 size={15} />
            </button>
            <span className="w-px h-4 bg-bd-default mx-0.5" aria-hidden />
            <button onClick={() => zoomBy(1 / 1.2)} className="p-1.5 rounded-md text-fg-subtle hover:text-fg-default hover:bg-interaction-hovered transition-colors" title="축소">
              <Minus size={15} />
            </button>
            <span className="min-w-[44px] text-center text-xs font-bold text-fg-default tabular-nums">{Math.round(zoom * 100)}%</span>
            <button onClick={() => zoomBy(1.2)} className="p-1.5 rounded-md text-fg-subtle hover:text-fg-default hover:bg-interaction-hovered transition-colors" title="확대">
              <Plus size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
