import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useTeamStore } from '../../stores/teamStore';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { useShowToast } from '../../components/ui/Toast';
import { MsButton } from '../../components/ui/MsButton';
import { MsInput } from '../../components/ui/MsControl';
import { EmptyState } from '../../components/ui/EmptyState';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import {
  approveMember,
  getPendingApprovals,
  rejectMember,
  type PendingApprovalRecord,
} from '../../utils/authApi';
import { generateEmployeeId } from '../../utils/sheetWriter';
import { timeAgo } from '../../utils/dateUtils';
import { getOrgDepth, getOrgLevelLabel } from '../../utils/teamUtils';

type DecisionState =
  | { type: 'idle' }
  | { type: 'approve'; record: PendingApprovalRecord }
  | { type: 'reject';  record: PendingApprovalRecord };

export function PendingApprovals() {
  const { currentUser } = useAuthStore();
  const { users, orgUnits, permissionGroups } = useTeamStore();
  const showToast = useShowToast();
  const navigate = useNavigate();

  const [items, setItems] = useState<PendingApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decision, setDecision] = useState<DecisionState>({ type: 'idle' });

  useSetPageHeader('승인 대기', null, {
    onBack: () => navigate('/team'),
    subtitle: items.length > 0 ? `${items.length}명 승인 대기 중` : '대기 중인 신규 회원이 없습니다',
  });

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getPendingApprovals();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '승인 대기 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  if (!currentUser) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {error && (
        <div className="mb-4 text-sm text-red-060 bg-red-005 px-4 py-3 rounded-lg">{error}</div>
      )}

      {loading && items.length === 0 && (
        <div className="flex items-center justify-center py-16 text-sm text-gray-040">
          <Loader2 className="size-4 mr-2 animate-spin" /> 불러오는 중...
        </div>
      )}

      {!loading && items.length === 0 && (
        <EmptyState
          illustration="empty-cycle"
          title="대기 중인 신규 회원이 없습니다"
          description="새 사용자가 처음 로그인하면 이곳에 표시됩니다."
          action={{ label: '구성원 페이지로', onClick: () => navigate('/team') }}
        />
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.email} className="bg-white rounded-xl border border-gray-010 shadow-card p-4 flex items-center gap-3">
              <div className="size-10 rounded-full bg-yellow-005 text-yellow-060 flex items-center justify-center flex-shrink-0 font-semibold text-sm">
                {(it.name || it.email).slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-gray-099 truncate">{it.name || '-'}</span>
                  <span className="text-xs text-gray-050 truncate">{it.email}</span>
                </div>
                <div className="text-xs text-gray-040 mt-0.5">
                  최초 로그인: {it.firstLoginAt ? timeAgo(it.firstLoginAt) : '-'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <MsButton size="sm" variant="ghost" onClick={() => setDecision({ type: 'reject', record: it })}>
                  <XCircle className="size-3.5 mr-1" /> 반려
                </MsButton>
                <MsButton size="sm" variant="brand1" onClick={() => setDecision({ type: 'approve', record: it })}>
                  <CheckCircle2 className="size-3.5 mr-1" /> 승인
                </MsButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {decision.type === 'approve' && (
        <ApproveDialog
          record={decision.record}
          users={users}
          orgUnits={orgUnits}
          permissionGroups={permissionGroups}
          approverId={currentUser.id}
          onClose={() => setDecision({ type: 'idle' })}
          onDone={async () => {
            setDecision({ type: 'idle' });
            await refresh();
            showToast('success', '신규 회원이 승인되었습니다.');
          }}
        />
      )}

      {decision.type === 'reject' && (
        <RejectDialog
          record={decision.record}
          approverId={currentUser.id}
          onClose={() => setDecision({ type: 'idle' })}
          onDone={async () => {
            setDecision({ type: 'idle' });
            await refresh();
            showToast('success', '신규 회원이 반려되었습니다.');
          }}
        />
      )}
    </div>
  );
}

/* ─────── 승인 다이얼로그 ─────── */

function ApproveDialog({
  record, users, orgUnits, permissionGroups, approverId, onClose, onDone,
}: {
  record: PendingApprovalRecord;
  users: ReturnType<typeof useTeamStore.getState>['users'];
  orgUnits: ReturnType<typeof useTeamStore.getState>['orgUnits'];
  permissionGroups: ReturnType<typeof useTeamStore.getState>['permissionGroups'];
  approverId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const showToast = useShowToast();
  const suggestedId = useMemo(() => generateEmployeeId(users), [users]);
  const [userId, setUserId] = useState(suggestedId);
  const [name, setName] = useState(record.name || record.email.split('@')[0]);
  const [position, setPosition] = useState('');
  const [orgUnitId, setOrgUnitId] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleGroup = (gid: string) => {
    setGroupIds(g => g.includes(gid) ? g.filter(x => x !== gid) : [...g, gid]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) { setError('사번을 입력해 주세요.'); return; }
    if (users.some(u => u.id === userId.trim())) {
      setError('이미 존재하는 사번입니다. 다른 사번을 사용해 주세요.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await approveMember({
        email:              record.email,
        userId:             userId.trim(),
        name:               name.trim(),
        position:           position.trim(),
        orgUnitId:          orgUnitId,
        permissionGroupIds: groupIds,
        approverId,
      });
      onDone();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '승인 중 오류가 발생했습니다.';
      setError(msg);
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogShell title={`${record.email} 승인`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <MsInput
            label="사번"
            value={userId}
            onChange={e => { setUserId(e.target.value); setError(''); }}
            placeholder={suggestedId}
          />
          <MsInput
            label="이름"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <MsInput
          label="직책 (선택)"
          value={position}
          onChange={e => setPosition(e.target.value)}
          placeholder="예: 데이터팀장"
        />
        <div>
          <label className="text-xs font-medium text-gray-080 block mb-1">소속 조직 (선택)</label>
          <select
            value={orgUnitId}
            onChange={e => setOrgUnitId(e.target.value)}
            className="w-full text-sm py-2 px-3 rounded-lg border border-gray-010 bg-white"
          >
            <option value="">선택하지 않음</option>
            {orgUnits.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} · {getOrgLevelLabel(getOrgDepth(u, orgUnits))}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-080 block mb-1.5">권한 그룹</label>
          <div className="space-y-1.5 max-h-40 overflow-auto bg-gray-005 rounded-lg p-2">
            {permissionGroups.length === 0 ? (
              <p className="text-xs text-gray-050 px-2 py-1.5">등록된 권한 그룹이 없습니다.</p>
            ) : (
              permissionGroups.map(g => (
                <label key={g.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupIds.includes(g.id)}
                    onChange={() => toggleGroup(g.id)}
                    className="size-3.5"
                  />
                  <span className="text-sm text-gray-099">{g.name}</span>
                  {g.isSystem && <span className="text-[11px] text-gray-040">(시스템)</span>}
                </label>
              ))
            )}
          </div>
          <p className="text-[11px] text-gray-040 mt-1">선택하지 않으면 권한 없는 일반 멤버로 등록됩니다.</p>
        </div>

        {error && <p className="text-xs text-red-050 bg-red-005 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <MsButton type="button" variant="ghost" onClick={onClose}>취소</MsButton>
          <MsButton type="submit" variant="brand1" loading={submitting} disabled={!userId.trim()}>
            승인
          </MsButton>
        </div>
      </form>
    </DialogShell>
  );
}

/* ─────── 반려 다이얼로그 ─────── */

function RejectDialog({
  record, approverId, onClose, onDone,
}: {
  record: PendingApprovalRecord;
  approverId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const showToast = useShowToast();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await rejectMember({ email: record.email, reason: reason.trim(), approverId });
      onDone();
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : '반려 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogShell title={`${record.email} 반려`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-sm text-gray-060">
          반려된 이메일은 이후 로그인 시도 시 차단됩니다. 다시 승인하려면 시트에서 직접 상태를 변경해야 합니다.
        </p>
        <MsInput
          label="반려 사유 (선택)"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="예: 외부 협력사 — 별도 절차로 등록 예정"
        />
        <div className="flex justify-end gap-2 pt-1">
          <MsButton type="button" variant="ghost" onClick={onClose}>취소</MsButton>
          <MsButton type="submit" variant="red" loading={submitting}>반려</MsButton>
        </div>
      </form>
    </DialogShell>
  );
}

/* ─────── 단순 다이얼로그 셸 ─────── */

function DialogShell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        role="dialog"
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-099">{title}</h2>
        {children}
      </div>
    </div>
  );
}
