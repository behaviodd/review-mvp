import type { ReviewCycle, ReviewStatus, ReviewType, User } from '../types';

export type CycleSort = 'created_desc' | 'created_asc' | 'deadline_asc' | 'completion_desc' | 'completion_asc';

export type FolderSelection =
  | { kind: 'all' }
  | { kind: 'none' }               // 폴더 미지정 사이클만
  | { kind: 'overdue' }             // 지연
  | { kind: 'this_quarter' }        // 이번 분기 생성
  | { kind: 'folder'; id: string }; // 사용자 폴더

export interface CycleFilters {
  query: string;
  statuses: ReviewStatus[];
  types: ReviewType[];
  tags: string[];
  includeArchived: boolean;
  dateFrom?: string;
  dateTo?: string;
  sort: CycleSort;
  folder: FolderSelection;
}

export const DEFAULT_CYCLE_FILTERS: CycleFilters = {
  query: '',
  statuses: [],
  types: [],
  tags: [],
  includeArchived: false,
  sort: 'created_desc',
  folder: { kind: 'all' },
};

function quarterRange(d: Date = new Date()): { from: string; to: string } {
  const y = d.getFullYear();
  const q = Math.floor(d.getMonth() / 3);
  const from = new Date(y, q * 3, 1).toISOString().slice(0, 10);
  const to = new Date(y, q * 3 + 3, 0).toISOString().slice(0, 10);
  return { from, to };
}

function isOverdueCycle(c: ReviewCycle): boolean {
  if (c.status === 'closed' || c.archivedAt) return false;
  if ((c.completionRate ?? 0) >= 100) return false;
  const today = new Date().toISOString().slice(0, 10);
  const deadline = c.status === 'manager_review' ? c.managerReviewDeadline : c.selfReviewDeadline;
  return deadline.slice(0, 10) < today;
}

function matchesFolder(c: ReviewCycle, sel: FolderSelection): boolean {
  switch (sel.kind) {
    case 'all':           return true;
    case 'none':          return !c.folderId;
    case 'overdue':       return isOverdueCycle(c);
    case 'this_quarter': {
      const { from, to } = quarterRange();
      const d = c.createdAt.slice(0, 10);
      return d >= from && d <= to;
    }
    case 'folder':        return c.folderId === sel.id;
  }
}

function matchesQuery(c: ReviewCycle, q: string, creator?: User): boolean {
  if (!q) return true;
  const hay = [
    c.title,
    creator?.name ?? '',
    (c.tags ?? []).join(' '),
  ].join(' ').toLowerCase();
  return hay.includes(q.toLowerCase());
}

export function applyCycleFilters(
  cycles: ReviewCycle[],
  users: User[],
  filters: CycleFilters,
): ReviewCycle[] {
  const userMap = new Map(users.map(u => [u.id, u]));
  const q = filters.query.trim();

  const list = cycles.filter(c => {
    if (!filters.includeArchived && c.archivedAt) return false;
    if (filters.includeArchived && !c.archivedAt) return false;
    if (!matchesFolder(c, filters.folder)) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(c.status)) return false;
    if (filters.types.length > 0 && !filters.types.includes(c.type)) return false;
    if (filters.tags.length > 0) {
      const tagSet = new Set(c.tags ?? []);
      if (!filters.tags.every(t => tagSet.has(t))) return false;
    }
    if (filters.dateFrom && c.createdAt.slice(0, 10) < filters.dateFrom) return false;
    if (filters.dateTo && c.createdAt.slice(0, 10) > filters.dateTo) return false;
    if (!matchesQuery(c, q, userMap.get(c.createdBy))) return false;
    return true;
  });

  const sorted = [...list].sort((a, b) => {
    switch (filters.sort) {
      case 'created_asc':     return a.createdAt.localeCompare(b.createdAt);
      case 'deadline_asc':    return a.selfReviewDeadline.localeCompare(b.selfReviewDeadline);
      case 'completion_asc':  return (a.completionRate ?? 0) - (b.completionRate ?? 0);
      case 'completion_desc': return (b.completionRate ?? 0) - (a.completionRate ?? 0);
      case 'created_desc':
      default:                return b.createdAt.localeCompare(a.createdAt);
    }
  });

  return sorted;
}

/* ── URL query 직렬화 ─────────────────────────────────────────────── */

const KEY = {
  q: 'q',
  status: 'status',
  type: 'type',
  tag: 'tag',
  sort: 'sort',
  from: 'from',
  to: 'to',
  archived: 'archived',
  folder: 'folder',
};

function folderToParam(sel: FolderSelection): string | null {
  if (sel.kind === 'all') return null;
  if (sel.kind === 'folder') return `folder:${sel.id}`;
  return sel.kind;
}

function paramToFolder(raw: string | null): FolderSelection {
  if (!raw) return { kind: 'all' };
  if (raw === 'none') return { kind: 'none' };
  if (raw === 'overdue') return { kind: 'overdue' };
  if (raw === 'this_quarter') return { kind: 'this_quarter' };
  if (raw.startsWith('folder:')) return { kind: 'folder', id: raw.slice(7) };
  return { kind: 'all' };
}

export function filtersToParams(f: CycleFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.query.trim()) p.set(KEY.q, f.query.trim());
  for (const s of f.statuses) p.append(KEY.status, s);
  for (const t of f.types) p.append(KEY.type, t);
  for (const t of f.tags) p.append(KEY.tag, t);
  if (f.sort !== DEFAULT_CYCLE_FILTERS.sort) p.set(KEY.sort, f.sort);
  if (f.dateFrom) p.set(KEY.from, f.dateFrom);
  if (f.dateTo) p.set(KEY.to, f.dateTo);
  if (f.includeArchived) p.set(KEY.archived, '1');
  const folderParam = folderToParam(f.folder);
  if (folderParam) p.set(KEY.folder, folderParam);
  return p;
}

export function paramsToFilters(p: URLSearchParams): CycleFilters {
  return {
    query: p.get(KEY.q) ?? '',
    statuses: p.getAll(KEY.status) as ReviewStatus[],
    types: p.getAll(KEY.type) as ReviewType[],
    tags: p.getAll(KEY.tag),
    includeArchived: p.get(KEY.archived) === '1',
    dateFrom: p.get(KEY.from) ?? undefined,
    dateTo: p.get(KEY.to) ?? undefined,
    sort: (p.get(KEY.sort) as CycleSort) ?? DEFAULT_CYCLE_FILTERS.sort,
    folder: paramToFolder(p.get(KEY.folder)),
  };
}
