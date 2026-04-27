import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTeamStore } from '../../stores/teamStore';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { useShowToast } from '../../components/ui/Toast';
import { MsButton } from '../../components/ui/MsButton';
import { MsCheckbox, MsInput, MsSelect } from '../../components/ui/MsControl';
import { OrgSelector } from '../../components/team/OrgSelector';
import { AVATAR_COLORS, buildInitOrgSel, resolveOrgNamesFromSel } from '../../utils/teamUtils';

export function MemberNew() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialOrgId = params.get('orgId') ?? undefined;
  const initialManagerId = params.get('managerId') ?? undefined;

  const { users, orgUnits, createMember, updateOrgUnit } = useTeamStore();
  const showToast = useShowToast();
  const headIds    = useMemo(() => new Set(orgUnits.map(u => u.headId).filter(Boolean)), [orgUnits]);
  const allLeaders = users.filter(u => u.role === 'admin' || headIds.has(u.id));
  const adminUser  = users.find(u => u.role === 'admin');

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '', nameEn: '', email: '', phone: '', joinDate: '',
    primaryRole: '', jobFunction: '', isPrimaryHead: false,
    managerId: initialManagerId ?? '',
  });
  const [orgSel, setOrgSel] = useState(() => buildInitOrgSel(initialOrgId, orgUnits));

  const f = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const hasOrgUnits = orgUnits.length > 0;
  const mostSpecificOrgId = orgSel.squadId || orgSel.teamId || orgSel.subOrgId || orgSel.mainOrgId;
  const isValid = !!form.name.trim() && !!form.email.trim();

  useSetPageHeader('구성원 추가', undefined, {
    onBack: () => navigate('/team'),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);

    const { department, subOrg, team, squad } = hasOrgUnits
      ? { ...resolveOrgNamesFromSel(orgSel, orgUnits), department: resolveOrgNamesFromSel(orgSel, orgUnits).department ?? '미배정' }
      : { department: '미배정', subOrg: undefined, team: undefined, squad: undefined };

    const managerId = form.managerId || adminUser?.id || undefined;

    const newId = await createMember({
      name:        form.name.trim(),
      nameEn:      form.nameEn.trim()     || undefined,
      email:       form.email.trim(),
      phone:       form.phone.trim()      || undefined,
      joinDate:    form.joinDate          || undefined,
      position:    form.primaryRole.trim() || '',
      jobFunction: form.jobFunction.trim() || undefined,
      role:        'member',
      department,
      subOrg, team, squad,
      managerId,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    });

    if (form.isPrimaryHead && mostSpecificOrgId) {
      updateOrgUnit(mostSpecificOrgId, { headId: newId });
    }
    showToast('success', `${form.name.trim()}님을 추가했습니다.`);
    navigate('/team');
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="bg-white rounded-xl border border-gray-020 shadow-card p-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 기본 정보 */}
          <section>
            <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide mb-3">기본 정보</p>
            <div className="grid grid-cols-2 gap-3">
              <MsInput autoFocus label="이름 *" type="text" value={form.name} onChange={f('name')} placeholder="홍길동" />
              <MsInput label="영문이름" type="text" value={form.nameEn} onChange={f('nameEn')} placeholder="Hong Gil-dong" />
              <MsInput label="이메일 *" type="email" value={form.email} onChange={f('email')} placeholder="name@company.com" />
              <MsInput label="연락처" type="text" value={form.phone} onChange={f('phone')} placeholder="010-0000-0000" />
              <MsInput label="입사일" type="date" value={form.joinDate} onChange={f('joinDate')} />
              <MsInput label="직무" type="text" value={form.jobFunction} onChange={f('jobFunction')} placeholder="프론트엔드 개발" />
            </div>
          </section>

          {/* 조직 · 역할 */}
          <section>
            <p className="text-[11px] font-semibold text-gray-040 uppercase tracking-wide mb-3">조직 · 역할</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <MsInput label="역할" type="text" value={form.primaryRole} onChange={f('primaryRole')} placeholder="예) iOS 개발자" />
                  </div>
                  <MsCheckbox size="md" checked={form.isPrimaryHead} disabled={!mostSpecificOrgId} onChange={e => setForm(p => ({ ...p, isPrimaryHead: e.target.checked }))} label={<span className={`text-xs font-medium ${mostSpecificOrgId ? 'text-gray-060' : 'text-gray-030'}`}>조직장</span>} className="pt-5" />
                </div>
              </div>
              <div className="col-span-2">
                <MsSelect label="보고 대상" value={form.managerId} onChange={f('managerId')}>
                  <option value="">없음 (자동 배정)</option>
                  {allLeaders.map(m => (
                    <option key={m.id} value={m.id}>{m.name} · {m.position}</option>
                  ))}
                </MsSelect>
              </div>
              {hasOrgUnits && (
                <OrgSelector orgUnits={orgUnits} value={orgSel} onChange={setOrgSel} />
              )}
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-010">
            <MsButton type="button" variant="ghost" onClick={() => navigate('/team')}>취소</MsButton>
            <MsButton type="submit" loading={submitting} disabled={!isValid}>추가</MsButton>
          </div>
        </form>
      </div>
    </div>
  );
}
