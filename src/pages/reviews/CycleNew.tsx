import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TagInput } from '../../components/review/TagInput';
import { buildClonePrefill } from '../../utils/cycleClone';
import { PreflightModal } from '../../components/review/modals/PreflightModal';
import { runPreflight, type PreflightResult } from '../../utils/cyclePreflight';
import type { CycleTargetMode } from '../../types';
import { CustomTargetPicker } from '../../components/review/cycleNew/CustomTargetPicker';
import { AutomationSection } from '../../components/review/cycleNew/AutomationSection';
import { PolicySection } from '../../components/review/cycleNew/PolicySection';
import { ReviewKindsSection } from '../../components/review/cycleNew/ReviewKindsSection';
import { DryRunModal } from '../../components/review/modals/DryRunModal';
import type { AutoAdvanceRule, ReminderRule, AnonymityPolicy, VisibilityPolicy, ReferenceInfoPolicy, ReviewKind, PeerSelectionPolicy, DistributionPolicy } from '../../types';
import { formToCyclePatch, cycleToForm } from '../../utils/cycleDraft';
import { timeAgo } from '../../utils/dateUtils';
import { useSetPageHeader } from '../../contexts/PageHeaderContext';
import { useReviewStore } from '../../stores/reviewStore';
import { useTeamStore } from '../../stores/teamStore';
import { useAuthStore } from '../../stores/authStore';
import { useShowToast } from '../../components/ui/Toast';
import { useFieldValidation } from '../../hooks/useFieldValidation';
import { createCycleSubmissions } from '../../utils/createCycleSubmissions';
import { Users, Eye, Rocket, PartyPopper } from 'lucide-react';
import {
  MsCheckIcon, MsChevronLeftLineIcon, MsChevronRightLineIcon, MsArticleIcon,
  MsCalendarIcon, MsPlusIcon, MsRefreshIcon, MsChevronDownLineIcon, MsInfoIcon,
} from '../../components/ui/MsIcons';
import { MsButton } from '../../components/ui/MsButton';
import { MsInput, MsSelect } from '../../components/ui/MsControl';

const STEPS = [
  { label: '기본 정보',    icon: MsArticleIcon  },
  { label: '리뷰 템플릿',  icon: MsArticleIcon  },
  { label: '대상 구성원',  icon: Users          },
  { label: '일정 설정',    icon: MsCalendarIcon },
  { label: '정책',         icon: MsArticleIcon  },
  { label: '검토 및 발행', icon: Eye            },
];

interface FormState {
  title: string;
  type: 'scheduled' | 'adhoc';
  templateId: string;
  targetDepartments: string[];
  targetSubOrgs: string[];
  targetTeams: string[];
  targetSquads: string[];
  selfReviewDeadline: string;
  managerReviewDeadline: string;
  calibrationDeadline: string;
  tags: string[];
  fromCycleId?: string;
  targetMode: CycleTargetMode;
  targetManagerId?: string;
  targetUserIds?: string[];
  scheduledPublishAt?: string;
  autoAdvance?: AutoAdvanceRule;
  reminderPolicy?: ReminderRule[];
  anonymity?: AnonymityPolicy;
  visibility?: VisibilityPolicy;
  referenceInfo?: ReferenceInfoPolicy;
  reviewKinds?: ReviewKind[];
  peerSelection?: PeerSelectionPolicy;
  distribution?: DistributionPolicy;
}

const today = new Date();
const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r.toISOString().slice(0, 10);
};

const DRAFT_KEY = 'cycleWizardDraft';

const TYPE_LABEL: Record<string, string> = {
  text: '주관식', rating: '평점', competency: '역량', multiple_choice: '객관식',
};

export function CycleNew() {
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuthStore();
  const { addCycle, updateCycle, upsertSubmission, templates, cycles: allCycles } = useReviewStore();
  const { users, orgUnits, isLoading: usersLoading } = useTeamStore();
  const showToast = useShowToast();

  useSetPageHeader('리뷰 사이클 생성');

  const departments = useMemo(
    () => Array.from(new Set(
      users.filter(u => u.role !== 'admin').map(u => u.department)
    )).sort(),
    [users],
  );

  const fromTemplateId = searchParams.get('templateId') ?? '';
  const newTemplateId  = searchParams.get('newTemplateId') ?? '';
  const fromCycleId    = searchParams.get('from') ?? '';
  const draftCycleIdParam = searchParams.get('draft') ?? '';

  // 새 템플릿 만들고 돌아왔을 때 sessionStorage에서 위저드 초안 복원
  const restoredDraft = useMemo(() => {
    if (!newTemplateId) return null;
    try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? 'null') as { form: FormState; step: number } | null; }
    catch { return null; }
  }, [newTemplateId]);

  const initialTemplateId = newTemplateId || fromTemplateId || (templates[0]?.id ?? '');

  const [step,           setStep]           = useState(restoredDraft?.step ?? 0);
  const [published,      setPublished]      = useState(false);
  const [publishedTitle, setPublishedTitle] = useState('');
  const [publishedId,    setPublishedId]    = useState('');
  const [publishedCount, setPublishedCount] = useState({ members: 0, submissions: 0 });
  const [publishing,     setPublishing]     = useState(false);
  const [templateLocked, setTemplateLocked] = useState(!!fromTemplateId || !!newTemplateId);
  const [preflightOpen,  setPreflightOpen]  = useState(false);
  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);
  const [dryRunOpen, setDryRunOpen] = useState(false);
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(true);

  const cloneOrigin = fromCycleId ? allCycles.find(c => c.id === fromCycleId) : undefined;
  const clonePrefill = cloneOrigin ? buildClonePrefill(cloneOrigin) : null;
  const draftOrigin = draftCycleIdParam ? allCycles.find(c => c.id === draftCycleIdParam) : undefined;
  const draftForm = draftOrigin ? cycleToForm(draftOrigin, addDays(today, 28)) : null;

  const [draftCycleId, setDraftCycleId] = useState<string | null>(draftOrigin ? draftOrigin.id : null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(draftOrigin ? new Date().toISOString() : null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<FormState>(
    draftForm
      ? (draftForm as FormState)
      : restoredDraft?.form ?? (clonePrefill
      ? {
          title:                 clonePrefill.title,
          type:                  clonePrefill.type,
          templateId:            clonePrefill.templateId || initialTemplateId,
          targetDepartments:     clonePrefill.targetDepartments,
          targetSubOrgs:         clonePrefill.targetSubOrgs,
          targetTeams:           clonePrefill.targetTeams,
          targetSquads:          clonePrefill.targetSquads,
          selfReviewDeadline:    clonePrefill.selfReviewDeadline,
          managerReviewDeadline: clonePrefill.managerReviewDeadline,
          calibrationDeadline:   addDays(today, 28),
          tags:                  clonePrefill.tags,
          fromCycleId:           clonePrefill.fromCycleId,
          targetMode:            'org',
        }
      : {
          title:                 '',
          type:                  'scheduled',
          templateId:            initialTemplateId,
          targetDepartments:     [],
          targetSubOrgs:         [],
          targetTeams:           [],
          targetSquads:          [],
          selfReviewDeadline:    addDays(today, 14),
          managerReviewDeadline: addDays(today, 21),
          calibrationDeadline:   addDays(today, 28),
          tags:                  [],
          targetMode:            'org',
        }),
  );
  const toggleDept = (dept: string) => {
    const subOrgs     = deptSubOrgsMap[dept] ?? [];
    const subOrgNames = subOrgs.map(o => o.name);
    const teamNames   = subOrgNames.flatMap(s => (subOrgTeamsMap[s] ?? []).map(o => o.name));
    const squadNames  = teamNames.flatMap(t => (teamSquadsMap[t] ?? []).map(o => o.name));
    const isSelected  = form.targetDepartments.includes(dept);
    const selectedSub = form.targetSubOrgs.filter(s => subOrgNames.includes(s));
    const isFullySelected = isSelected && (subOrgNames.length === 0 || selectedSub.length === subOrgNames.length);

    if (isFullySelected) {
      // 전체 선택 → 전체 해제
      setForm(f => ({
        ...f,
        targetDepartments: f.targetDepartments.filter(d => d !== dept),
        targetSubOrgs:     f.targetSubOrgs.filter(s => !subOrgNames.includes(s)),
        targetTeams:       f.targetTeams.filter(t => !teamNames.includes(t)),
        targetSquads:      f.targetSquads.filter(s => !squadNames.includes(s)),
      }));
    } else {
      // 미선택 or 일부 선택([-]) → 전체 선택 (하위 계층 모두 포함)
      setForm(f => ({
        ...f,
        targetDepartments: isSelected ? f.targetDepartments : [...f.targetDepartments, dept],
        targetSubOrgs:     [...f.targetSubOrgs.filter(s => !subOrgNames.includes(s)), ...subOrgNames],
        targetTeams:       [...f.targetTeams.filter(t => !teamNames.includes(t)), ...teamNames],
        targetSquads:      [...f.targetSquads.filter(s => !squadNames.includes(s)), ...squadNames],
      }));
    }
  };

  const toggleSubOrg = (dept: string, subOrgName: string) => {
    const teams          = subOrgTeamsMap[subOrgName] ?? [];
    const teamNames      = teams.map(o => o.name);
    const squadNames     = teamNames.flatMap(t => (teamSquadsMap[t] ?? []).map(o => o.name));
    const subOrgsForDept = (deptSubOrgsMap[dept] ?? []).map(o => o.name);
    const isSelected     = form.targetSubOrgs.includes(subOrgName);
    const selectedTeams  = form.targetTeams.filter(t => teamNames.includes(t));
    const isFullyChecked = isSelected && (teamNames.length === 0 || selectedTeams.length === teamNames.length);

    if (isFullyChecked) {
      // 전체 선택 → 해제 (마지막이면 주조직도 해제)
      const newSubOrgs       = form.targetSubOrgs.filter(s => s !== subOrgName);
      const remainingForDept = newSubOrgs.filter(s => subOrgsForDept.includes(s));
      setForm(f => ({
        ...f,
        targetDepartments: remainingForDept.length === 0
          ? f.targetDepartments.filter(d => d !== dept)
          : f.targetDepartments,
        targetSubOrgs: newSubOrgs,
        targetTeams:   f.targetTeams.filter(t => !teamNames.includes(t)),
        targetSquads:  f.targetSquads.filter(s => !squadNames.includes(s)),
      }));
    } else {
      // 미선택 or [-] → 전체 선택 (팀/스쿼드 포함)
      setForm(f => ({
        ...f,
        targetSubOrgs: isSelected ? f.targetSubOrgs : [...f.targetSubOrgs, subOrgName],
        targetTeams:   [...f.targetTeams.filter(t => !teamNames.includes(t)), ...teamNames],
        targetSquads:  [...f.targetSquads.filter(s => !squadNames.includes(s)), ...squadNames],
      }));
    }
  };

  const toggleTeam = (dept: string, subOrgName: string, teamName: string) => {
    const squads         = teamSquadsMap[teamName] ?? [];
    const squadNames     = squads.map(o => o.name);
    const teamsForSubOrg = (subOrgTeamsMap[subOrgName] ?? []).map(o => o.name);
    const subOrgsForDept = (deptSubOrgsMap[dept] ?? []).map(o => o.name);
    const isSelected     = form.targetTeams.includes(teamName);
    const selectedSquads = form.targetSquads.filter(s => squadNames.includes(s));
    const isFullyChecked = isSelected && (squadNames.length === 0 || selectedSquads.length === squadNames.length);

    if (isFullyChecked) {
      // 전체 선택 → 해제 (마지막이면 부조직·주조직도 연쇄 해제)
      const newTeams             = form.targetTeams.filter(t => t !== teamName);
      const remainingForSubOrg   = newTeams.filter(t => teamsForSubOrg.includes(t));
      const newSubOrgs           = remainingForSubOrg.length === 0
        ? form.targetSubOrgs.filter(s => s !== subOrgName)
        : form.targetSubOrgs;
      const remainingForDept     = newSubOrgs.filter(s => subOrgsForDept.includes(s));
      setForm(f => ({
        ...f,
        targetDepartments: remainingForDept.length === 0
          ? f.targetDepartments.filter(d => d !== dept)
          : f.targetDepartments,
        targetSubOrgs: newSubOrgs,
        targetTeams:   newTeams,
        targetSquads:  f.targetSquads.filter(s => !squadNames.includes(s)),
      }));
    } else {
      // 미선택 or [-] → 전체 선택 (스쿼드 포함)
      setForm(f => ({
        ...f,
        targetTeams:  isSelected ? f.targetTeams : [...f.targetTeams, teamName],
        targetSquads: [...f.targetSquads.filter(s => !squadNames.includes(s)), ...squadNames],
      }));
    }
  };

  const toggleSquad = (dept: string, subOrgName: string, teamName: string, squadName: string) => {
    const squadsForTeam  = (teamSquadsMap[teamName] ?? []).map(o => o.name);
    const teamsForSubOrg = (subOrgTeamsMap[subOrgName] ?? []).map(o => o.name);
    const subOrgsForDept = (deptSubOrgsMap[dept] ?? []).map(o => o.name);
    const isSelected     = form.targetSquads.includes(squadName);

    if (isSelected) {
      const newSquads          = form.targetSquads.filter(s => s !== squadName);
      const remainingForTeam   = newSquads.filter(s => squadsForTeam.includes(s));
      const newTeams           = remainingForTeam.length === 0
        ? form.targetTeams.filter(t => t !== teamName) : form.targetTeams;
      const remainingForSubOrg = newTeams.filter(t => teamsForSubOrg.includes(t));
      const newSubOrgs         = remainingForSubOrg.length === 0
        ? form.targetSubOrgs.filter(s => s !== subOrgName) : form.targetSubOrgs;
      const remainingForDept   = newSubOrgs.filter(s => subOrgsForDept.includes(s));
      setForm(f => ({
        ...f,
        targetDepartments: remainingForDept.length === 0
          ? f.targetDepartments.filter(d => d !== dept)
          : f.targetDepartments,
        targetSubOrgs: newSubOrgs,
        targetTeams:   newTeams,
        targetSquads:  newSquads,
      }));
    } else {
      setForm(f => ({ ...f, targetSquads: [...f.targetSquads, squadName] }));
    }
  };


  const selectAllDepts = () => {
    const allSubOrgNames = departments.flatMap(dept  => (deptSubOrgsMap[dept]     ?? []).map(o => o.name));
    const allTeamNames   = allSubOrgNames.flatMap(s  => (subOrgTeamsMap[s]        ?? []).map(o => o.name));
    const allSquadNames  = allTeamNames.flatMap(t    => (teamSquadsMap[t]          ?? []).map(o => o.name));
    setForm(f => ({ ...f, targetDepartments: [...departments], targetSubOrgs: allSubOrgNames, targetTeams: allTeamNames, targetSquads: allSquadNames }));
  };
  const deselectAllDepts = () =>
    setForm(f => ({ ...f, targetDepartments: [], targetSubOrgs: [], targetTeams: [], targetSquads: [] }));

  // 새 템플릿 복귀 시: 새 템플릿 자동 선택 + sessionStorage 정리
  useEffect(() => {
    if (newTemplateId && restoredDraft) {
      setForm(f => ({ ...f, templateId: newTemplateId }));
      sessionStorage.removeItem(DRAFT_KEY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedTemplate = templates.find(t => t.id === form.templateId);

  // dept → subOrg units 매핑
  const deptSubOrgsMap = useMemo(() => {
    const map: Record<string, { id: string; name: string }[]> = {};
    const mainOrgUnits = orgUnits.filter(o => o.type === 'mainOrg');
    const subOrgUnits  = orgUnits.filter(o => o.type === 'subOrg');
    for (const dept of departments) {
      const mainUnit = mainOrgUnits.find(o => o.name === dept);
      map[dept] = mainUnit
        ? subOrgUnits.filter(o => o.parentId === mainUnit.id).map(o => ({ id: o.id, name: o.name }))
        : [];
    }
    return map;
  }, [orgUnits, departments]);

  // subOrg name → team units 매핑
  const subOrgTeamsMap = useMemo(() => {
    const map: Record<string, { id: string; name: string }[]> = {};
    const subOrgUnits = orgUnits.filter(o => o.type === 'subOrg');
    const teamUnits   = orgUnits.filter(o => o.type === 'team');
    for (const subOrg of subOrgUnits) {
      map[subOrg.name] = teamUnits.filter(o => o.parentId === subOrg.id).map(o => ({ id: o.id, name: o.name }));
    }
    return map;
  }, [orgUnits]);

  // team name → squad units 매핑
  const teamSquadsMap = useMemo(() => {
    const map: Record<string, { id: string; name: string }[]> = {};
    const teamUnits   = orgUnits.filter(o => o.type === 'team');
    const squadUnits  = orgUnits.filter(o => o.type === 'squad');
    for (const team of teamUnits) {
      map[team.name] = squadUnits.filter(o => o.parentId === team.id).map(o => ({ id: o.id, name: o.name }));
    }
    return map;
  }, [orgUnits]);

  const targetMembers = useMemo(() => {
    if (form.targetMode === 'manager') {
      if (!form.targetManagerId) return [];
      return users.filter(u => u.managerId === form.targetManagerId && u.role !== 'admin');
    }
    if (form.targetMode === 'custom') {
      const set = new Set(form.targetUserIds ?? []);
      return users.filter(u => set.has(u.id) && u.role !== 'admin');
    }
    return users.filter(u => {
      if (u.role === 'admin') return false;
      if (!form.targetDepartments.includes(u.department)) return false;
      const subOrgsForDept = deptSubOrgsMap[u.department] ?? [];
      if (subOrgsForDept.length > 0 && !form.targetSubOrgs.includes(u.subOrg ?? '')) return false;
      const teamsForSubOrg = subOrgTeamsMap[u.subOrg ?? ''] ?? [];
      if (teamsForSubOrg.length > 0 && !form.targetTeams.includes(u.team ?? '')) return false;
      const squadsForTeam = teamSquadsMap[u.team ?? ''] ?? [];
      if (squadsForTeam.length > 0 && !form.targetSquads.includes(u.squad ?? '')) return false;
      return true;
    });
  }, [users, form.targetMode, form.targetManagerId, form.targetUserIds, form.targetDepartments, form.targetSubOrgs, form.targetTeams, form.targetSquads, deptSubOrgsMap, subOrgTeamsMap, teamSquadsMap]);

  const managerCandidates = useMemo(
    () => users
      .filter(m => m.role !== 'admin' && m.isActive !== false && users.some(u => u.managerId === m.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [users],
  );
  const customCandidates = useMemo(
    () => users
      .filter(u => u.role !== 'admin' && u.isActive !== false)
      .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [users],
  );

  const previewSubmissions = useMemo(
    () => createCycleSubmissions('preview', targetMembers, users),
    [targetMembers, users],
  );
  const selfCount = previewSubmissions.filter(s => s.type === 'self').length;
  const downCount = previewSubmissions.filter(s => s.type === 'downward').length;

  /* ── 유효성 검사 ─────────────────────────────────────────── */
  const validationRules = useMemo(() => ({
    title: (v: unknown) =>
      String(v ?? '').trim().length < 2 ? '리뷰 이름은 2자 이상 입력해주세요.' : null,
    managerReviewDeadline: (v: unknown) => {
      if (!form.selfReviewDeadline || !v) return null;
      return new Date(v as string) <= new Date(form.selfReviewDeadline)
        ? '매니저 리뷰 마감일은 자기평가 마감일 이후여야 합니다.'
        : null;
    },
  }), [form.selfReviewDeadline]);

  const { errors: formErrors, touch, clearError, resetErrors } = useFieldValidation(
    form as unknown as Record<string, unknown>,
    validationRules as Parameters<typeof useFieldValidation>[1],
  );

  const canNext = () => {
    if (step === 0) return form.title.trim().length >= 2;
    if (step === 1) return !!form.templateId;
    if (step === 2) {
      if (form.targetMode === 'manager') return !!form.targetManagerId && targetMembers.length > 0;
      if (form.targetMode === 'custom') return (form.targetUserIds?.length ?? 0) > 0;
      return form.targetDepartments.length > 0;
    }
    if (step === 3) return !!(form.selfReviewDeadline && form.managerReviewDeadline);
    return true;
  };

  // 새 템플릿 만들기: 위저드 상태 저장 후 이동
  const handleGoCreateTemplate = () => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step: 1 }));
    navigate('/templates/new?returnTo=cycle-wizard');
  };

  /* ── 단계별 Draft 저장 ────────────────────────────────────── */
  const persistDraftAndAdvance = async () => {
    if (!currentUser) { setStep(s => s + 1); return; }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const patch = formToCyclePatch(form);
      if (draftCycleId) {
        updateCycle(draftCycleId, patch);
      } else {
        const newId = `cyc_${Date.now()}`;
        addCycle({
          id: newId,
          title: form.title || '제목 없음',
          type: form.type,
          status: 'draft',
          templateId: form.templateId,
          targetDepartments: form.targetDepartments,
          selfReviewDeadline: form.selfReviewDeadline ? new Date(form.selfReviewDeadline).toISOString() : '',
          managerReviewDeadline: form.managerReviewDeadline ? new Date(form.managerReviewDeadline).toISOString() : '',
          createdBy: currentUser.id,
          createdAt: now,
          completionRate: 0,
          tags: form.tags,
          fromCycleId: form.fromCycleId,
          targetMode: form.targetMode,
          targetManagerId: form.targetManagerId,
          targetUserIds: form.targetUserIds,
          scheduledPublishAt: form.scheduledPublishAt,
          autoAdvance: form.autoAdvance,
          reminderPolicy: form.reminderPolicy,
          anonymity: form.anonymity,
          visibility: form.visibility,
          referenceInfo: form.referenceInfo,
        });
        setDraftCycleId(newId);
        // URL에 draft 쿼리 반영 (뒤로가기 · 새로고침 시 이어가기)
        const next = new URLSearchParams(searchParams);
        next.set('draft', newId);
        next.delete('from');
        next.delete('templateId');
        next.delete('newTemplateId');
        navigate(`/cycles/new?${next.toString()}`, { replace: true });
      }
      setLastSavedAt(new Date().toISOString());
      setStep(s => s + 1);
    } finally {
      setSaving(false);
    }
  };

  /* ── 사전 점검 + 발행 ────────────────────────────────────── */
  const openPreflight = () => {
    const template = templates.find(t => t.id === form.templateId);
    const now = new Date().toISOString();
    const candidate: typeof allCycles[number] = {
      id: 'candidate',
      title: form.title,
      type: form.type,
      status: 'draft',
      templateId: form.templateId,
      targetDepartments: form.targetDepartments,
      selfReviewDeadline: new Date(form.selfReviewDeadline).toISOString(),
      managerReviewDeadline: new Date(form.managerReviewDeadline).toISOString(),
      createdBy: currentUser?.id ?? 'system',
      createdAt: now,
      completionRate: 0,
      tags: form.tags,
      fromCycleId: form.fromCycleId,
      targetMode: form.targetMode,
      targetManagerId: form.targetManagerId,
      targetUserIds: form.targetUserIds,
    };
    const result = runPreflight({
      cycle: candidate,
      allCycles,
      users,
      orgUnits,
      template,
    });
    setPreflightResult(result);
    setPreflightOpen(true);
  };

  const handlePublish = async () => {
    if (!currentUser || publishing) return;
    setPublishing(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      const cycleId = `cyc_${Date.now()}`;
      const template = templates.find(t => t.id === form.templateId);
      const now = new Date().toISOString();

      // 예약 발행이 켜져 있으면 draft로 보관, 스케줄러가 시간 도래 시 발행
      const isScheduled = !!form.scheduledPublishAt && new Date(form.scheduledPublishAt).getTime() > Date.now();
      const status = isScheduled ? 'draft' : 'self_review';
      const snapshot = isScheduled ? undefined : template;
      const snapshotAt = isScheduled ? undefined : (template ? now : undefined);

      if (draftCycleId) {
        // 기존 draft 승격
        updateCycle(draftCycleId, {
          title: form.title,
          type: form.type,
          status,
          templateId: form.templateId,
          targetDepartments: form.targetDepartments,
          selfReviewDeadline: new Date(form.selfReviewDeadline).toISOString(),
          managerReviewDeadline: new Date(form.managerReviewDeadline).toISOString(),
          completionRate: 0,
          tags: form.tags,
          fromCycleId: form.fromCycleId,
          templateSnapshot: snapshot,
          templateSnapshotAt: snapshotAt,
          targetMode: form.targetMode,
          targetManagerId: form.targetManagerId,
          targetUserIds: form.targetUserIds,
          scheduledPublishAt: isScheduled ? form.scheduledPublishAt : undefined,
          autoAdvance: form.autoAdvance,
          reminderPolicy: form.reminderPolicy,
          anonymity: form.anonymity,
          visibility: form.visibility,
          referenceInfo: form.referenceInfo,
          reviewKinds: form.reviewKinds,
          peerSelection: form.peerSelection,
          distribution: form.distribution,
        });
      } else {
        addCycle({
          id:                    cycleId,
          title:                 form.title,
          type:                  form.type,
          status,
          templateId:            form.templateId,
          targetDepartments:     form.targetDepartments,
          selfReviewDeadline:    new Date(form.selfReviewDeadline).toISOString(),
          managerReviewDeadline: new Date(form.managerReviewDeadline).toISOString(),
          createdBy:             currentUser.id,
          createdAt:             now,
          completionRate:        0,
          tags:                  form.tags,
          fromCycleId:           form.fromCycleId,
          templateSnapshot:      snapshot,
          templateSnapshotAt:    snapshotAt,
          targetMode:            form.targetMode,
          targetManagerId:       form.targetManagerId,
          targetUserIds:         form.targetUserIds,
          scheduledPublishAt:    isScheduled ? form.scheduledPublishAt : undefined,
          autoAdvance:           form.autoAdvance,
          reminderPolicy:        form.reminderPolicy,
          anonymity:             form.anonymity,
          visibility:            form.visibility,
          referenceInfo:         form.referenceInfo,
          reviewKinds:           form.reviewKinds,
          peerSelection:         form.peerSelection,
          distribution:          form.distribution,
        });
      }

      const actualId = draftCycleId ?? cycleId;

      let subs: ReturnType<typeof createCycleSubmissions> = [];
      if (!isScheduled) {
        // 자동 제외: isActive=false / leaveDate <= today 인 대상자는 submission 생성 skip
        const todayKey = new Date().toISOString().slice(0, 10);
        const eligible = targetMembers.filter(m => m.isActive !== false && !(m.leaveDate && m.leaveDate <= todayKey));
        subs = createCycleSubmissions(actualId, eligible, users, orgUnits, {
          reviewKinds: form.reviewKinds,
        });
        subs.forEach(sub => upsertSubmission(sub));
      }

      showToast('success', isScheduled
        ? `예약 발행 등록 완료 · ${new Date(form.scheduledPublishAt!).toLocaleString('ko-KR')} 에 자동 발행됩니다.`
        : `리뷰 발행 완료 · 제출 ${subs.length}건 생성`);
      setPublishedTitle(form.title);
      setPublishedId(actualId);
      setPublishedCount({ members: targetMembers.length, submissions: subs.length });
      setPublished(true);
    } finally {
      setPublishing(false);
      setPreflightOpen(false);
    }
  };

  /* ── 발행 완료 화면 ──────────────────────────────────────── */
  if (published) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-6">
        <div className="w-20 h-20 bg-green-005 rounded-full flex items-center justify-center mx-auto">
          <PartyPopper className="w-10 h-10 text-green-040" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-099">리뷰가 발행되었습니다!</h1>
          <p className="text-gray-050 text-sm">
            <span className="font-semibold text-gray-070">"{publishedTitle}"</span> 리뷰가 성공적으로 시작되었습니다.
          </p>
        </div>
        <div className="bg-gray-005 rounded-lg p-5 text-left space-y-3">
          {[
            { label: '자기평가 마감',    value: form.selfReviewDeadline },
            { label: '매니저 리뷰 마감', value: form.managerReviewDeadline },
            { label: '대상 구성원',      value: `${publishedCount.members}명` },
            { label: '생성된 제출 건',   value: `자기평가 ${selfCount}건 · 매니저 평가 ${downCount}건` },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="text-gray-040 w-32 flex-shrink-0">{label}</span>
              <span className="font-medium text-gray-080">{value}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <MsButton onClick={() => navigate(`/cycles/${publishedId}`)} className="w-full h-auto py-2.5">
            리뷰 상세보기 →
          </MsButton>
          <div className="flex gap-2">
            <MsButton variant="default" className="flex-1" onClick={() => navigate('/cycles')}>
              리뷰 목록 보기
            </MsButton>
            <MsButton
              variant="default"
              className="flex-1"
              onClick={() => {
                setPublished(false);
                setPublishedId('');
                setStep(0);
                setTemplateLocked(false);
                setForm({
                  title: '', type: 'scheduled', templateId: templates[0]?.id ?? '',
                  targetDepartments: [], targetSubOrgs: [], targetTeams: [], targetSquads: [],
                  selfReviewDeadline:    addDays(today, 14),
                  managerReviewDeadline: addDays(today, 21),
                  calibrationDeadline:   addDays(today, 28),
                  tags: [],
                  targetMode: 'org',
                });
              }}
            >
              새 리뷰 만들기
            </MsButton>
          </div>
        </div>
      </div>
    );
  }

  /* ── 스텝 화면 ──────────────────────────────────────────── */
  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-end gap-2 text-[11px]">
        {draftCycleId ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-005 border border-blue-020 px-2 py-0.5 font-semibold text-blue-070">
            임시 저장됨 · {lastSavedAt ? timeAgo(lastSavedAt) : '방금'}
          </span>
        ) : (
          <span className="text-gray-040">저장되지 않은 변경사항</span>
        )}
      </div>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-0 mb-8">
        {STEPS.map((s, i) => {
          const done    = i < step;
          const current = i === step;
          return (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  done ? 'bg-pink-040 text-white' : current ? 'bg-pink-050 text-white' : 'bg-gray-010 text-gray-040'
                }`}>
                  {done ? <MsCheckIcon size={16} /> : i + 1}
                </div>
                <span className={`text-xs whitespace-nowrap ${current || done ? 'text-pink-060 font-semibold' : 'text-gray-040'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mb-5 mx-1 ${done ? 'bg-pink-040' : 'bg-gray-020'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* 스텝 콘텐츠 */}
      <div className="bg-white rounded-xl border border-gray-010 shadow-card p-6 mb-5 min-h-[320px]">

        {/* Step 0: 기본 정보 */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-099">기본 정보를 입력하세요</h2>
            <MsInput
              label="리뷰 이름 *"
              type="text"
              value={form.title}
              onChange={e => { setForm(f => ({ ...f, title: e.target.value })); clearError('title'); }}
              onBlur={() => touch('title')}
              placeholder="예: 2025년 하반기 성과 리뷰"
              error={formErrors.title}
            />
            <div>
              <label className="block text-sm font-medium text-gray-070 mb-1.5">리뷰 유형</label>
              <div className="rounded-xl border border-gray-020 divide-y divide-gray-010 overflow-hidden">
                {([
                  ['scheduled', '정기 리뷰',  '분기/반기 정기 평가'],
                  ['adhoc',     '수시 리뷰',  '프로젝트 완료 후 수시 평가'],
                ] as const).map(([val, label, desc]) => (
                  <button key={val} type="button"
                    onClick={() => setForm(f => ({ ...f, type: val }))}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-005 transition-colors">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                      form.type === val ? 'bg-pink-040' : 'border-2 border-gray-030'
                    }`}>
                      {form.type === val && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${form.type === val ? 'text-gray-099' : 'text-gray-060'}`}>{label}</p>
                      <p className="text-xs text-gray-040">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-070 mb-1.5">태그 (선택)</label>
              <TagInput
                value={form.tags}
                onChange={tags => setForm(f => ({ ...f, tags }))}
                suggestions={Array.from(new Set(allCycles.flatMap(c => c.tags ?? [])))}
                placeholder="예: 분기, 성과, 리더십"
              />
            </div>

            <ReviewKindsSection form={form} setForm={setForm} />
            {cloneOrigin && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-020 bg-blue-005 px-3 py-2.5">
                <MsInfoIcon size={14} className="mt-0.5 shrink-0 text-blue-070" />
                <div className="text-xs text-blue-070 leading-relaxed">
                  <strong>복제 원본:</strong> "{cloneOrigin.title}" · 일정·태그·대상 부서가 미리 채워져 있습니다. 필요한 항목을 수정해 주세요.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: 템플릿 */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-099">리뷰 템플릿 선택</h2>
              <button
                type="button"
                onClick={handleGoCreateTemplate}
                className="flex items-center gap-1 text-xs text-pink-050 hover:text-pink-060 font-medium"
              >
                <MsPlusIcon size={12} /> 새 템플릿 만들기
              </button>
            </div>

            {/* 템플릿에서 진입: 선택된 템플릿 확인 */}
            {templateLocked && selectedTemplate ? (
              <div className="rounded-xl border border-gray-020 divide-y divide-gray-010 overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 bg-pink-040">
                    <MsCheckIcon size={10} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-099">{selectedTemplate.name}</p>
                    <p className="text-xs text-gray-040 mt-0.5 truncate">{selectedTemplate.description}</p>
                  </div>
                  <span className="text-xs text-gray-040 bg-gray-010 px-2 py-0.5 rounded flex-shrink-0">{selectedTemplate.questions.length}문항</span>
                  <button type="button" onClick={() => setTemplateLocked(false)}
                    className="flex items-center gap-1 text-xs text-gray-040 hover:text-gray-060 flex-shrink-0 ml-2">
                    <MsRefreshIcon size={12} /> 변경
                  </button>
                </div>
                <div className="pl-11 pr-4 py-2.5 space-y-1">
                  {selectedTemplate.questions.slice(0, 3).map(q => (
                    <p key={q.id} className="text-xs text-gray-040">• {q.text}</p>
                  ))}
                  {selectedTemplate.questions.length > 3 && (
                    <p className="text-xs text-gray-030">+{selectedTemplate.questions.length - 3}개 더...</p>
                  )}
                </div>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <MsArticleIcon size={32} className="text-gray-020 mx-auto" />
                <p className="text-sm text-gray-050 font-medium">저장된 템플릿이 없습니다</p>
                <p className="text-xs text-gray-040">템플릿을 먼저 만들어야 리뷰를 생성할 수 있습니다.</p>
                <MsButton type="button" onClick={handleGoCreateTemplate} leftIcon={<MsPlusIcon size={16} />}>새 템플릿 만들기</MsButton>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-020 divide-y divide-gray-010 overflow-hidden">
                {templates.map(t => {
                  const isSelected = form.templateId === t.id;
                  return (
                    <div key={t.id}>
                      <button type="button"
                        onClick={() => { setForm(f => ({ ...f, templateId: t.id })); setTemplateLocked(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-005 transition-colors">
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'bg-pink-040' : 'border-2 border-gray-030'
                        }`}>
                          {isSelected && <MsCheckIcon size={10} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${isSelected ? 'text-gray-099' : 'text-gray-060'}`}>{t.name}</p>
                          <p className="text-xs text-gray-040 mt-0.5 truncate">{t.description}</p>
                        </div>
                        <span className="text-xs text-gray-040 bg-gray-010 px-2 py-0.5 rounded flex-shrink-0">{t.questions.length}문항</span>
                      </button>
                      {isSelected && (
                        <div className="pl-11 pr-4 py-2.5 border-t border-gray-010 space-y-1">
                          {t.questions.slice(0, 3).map(q => (
                            <p key={q.id} className="text-xs text-gray-040">• {q.text}</p>
                          ))}
                          {t.questions.length > 3 && (
                            <p className="text-xs text-gray-030">+{t.questions.length - 3}개 더...</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 2: 대상 구성원 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-099">대상 구성원 선택</h2>
            </div>

            <div className="inline-flex rounded-lg border border-gray-010 bg-gray-005 p-0.5">
              {([
                ['org',     '조직 기준'],
                ['manager', '매니저 기준'],
                ['custom',  '직접 선택'],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, targetMode: val }))}
                  className={`px-3 h-7 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    form.targetMode === val ? 'bg-white text-gray-080 shadow-card' : 'text-gray-050 hover:text-gray-070'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {form.targetMode === 'manager' && (
              <div className="rounded-xl border border-gray-010 bg-white p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-060 mb-1">매니저 선택</label>
                  <MsSelect
                    value={form.targetManagerId ?? ''}
                    onChange={e => setForm(f => ({ ...f, targetManagerId: e.target.value || undefined }))}
                    className="min-w-[240px]"
                  >
                    <option value="">매니저를 선택하세요</option>
                    {managerCandidates.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name} · {m.position} · {m.department}
                      </option>
                    ))}
                  </MsSelect>
                </div>
                <p className="text-xs text-gray-040">
                  선택된 매니저의 부하 직원 <strong className="text-gray-080">{targetMembers.length}명</strong>이 대상자로 지정됩니다.
                </p>
              </div>
            )}

            {form.targetMode === 'custom' && (
              <CustomTargetPicker
                candidates={customCandidates}
                selectedIds={form.targetUserIds ?? []}
                onChange={ids => setForm(f => ({ ...f, targetUserIds: ids }))}
              />
            )}

            {form.targetMode === 'org' && (departments.length > 0 && (
              <div className="flex items-center gap-3 text-xs font-medium">
                <button type="button" onClick={selectAllDepts} className="text-pink-050 hover:text-pink-060 transition-colors">전체 선택</button>
                <button type="button" onClick={deselectAllDepts} className="text-gray-040 hover:text-gray-060 transition-colors">전체 해제</button>
              </div>
            ))}

            {form.targetMode === 'org' && (departments.length === 0 ? (
              <p className="text-sm text-gray-040 py-4">등록된 부서가 없습니다. 팀 구성에서 구성원을 추가해주세요.</p>
            ) : (
              <div className="space-y-2">
                {departments.map(dept => {
                  const subOrgs          = deptSubOrgsMap[dept] ?? [];
                  const subOrgNames      = subOrgs.map(o => o.name);
                  const deptSelected     = form.targetDepartments.includes(dept);
                  const selectedSub      = form.targetSubOrgs.filter(s => subOrgNames.includes(s));
                  const isIndeterminate  = deptSelected && subOrgNames.length > 0
                    && selectedSub.length > 0 && selectedSub.length < subOrgNames.length;
                  const isFullyChecked   = deptSelected
                    && (subOrgNames.length === 0 || selectedSub.length === subOrgNames.length);
                  const totalDeptCount   = users.filter(u => u.department === dept && u.role !== 'admin').length;
                  const selectedInDept   = deptSelected ? targetMembers.filter(u => u.department === dept).length : 0;

                  return (
                    <div key={dept} className={`rounded-xl border transition-all overflow-hidden ${
                      (isFullyChecked || isIndeterminate) ? 'border-pink-020 bg-pink-005/30' : 'border-gray-020 bg-white'
                    }`}>
                      {/* 주조직 행 */}
                      <button type="button" onClick={() => toggleDept(dept)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors">
                        {/* 체크박스: checked / indeterminate[-] / unchecked */}
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                          (isFullyChecked || isIndeterminate) ? 'bg-pink-040' : 'border-2 border-gray-030 bg-white'
                        }`}>
                          {isFullyChecked   && <MsCheckIcon size={11} className="text-white" />}
                          {isIndeterminate  && <span className="text-white font-bold text-sm leading-none select-none">−</span>}
                        </div>
                        <span className={`flex-1 text-sm font-semibold ${deptSelected ? 'text-gray-099' : 'text-gray-050'}`}>
                          {dept}
                        </span>
                        {deptSelected ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-pink-010 text-pink-050">
                            {isIndeterminate ? `${selectedInDept}명 선택` : `전체 ${totalDeptCount}명`}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-040">{totalDeptCount}명</span>
                        )}
                      </button>

                      {/* 부조직 → 팀 → 스쿼드 트리 */}
                      {deptSelected && subOrgs.length > 0 && (
                        <div className="border-t border-pink-010">
                          {subOrgs.map(subOrg => {
                            const subSelected    = form.targetSubOrgs.includes(subOrg.name);
                            const subCount       = users.filter(u => u.department === dept && u.subOrg === subOrg.name && u.role !== 'admin').length;
                            const subTeams       = subOrgTeamsMap[subOrg.name] ?? [];
                            const subTeamNames   = subTeams.map(o => o.name);
                            const selSubTeams    = form.targetTeams.filter(t => subTeamNames.includes(t));
                            const subIndeterm    = subSelected && subTeamNames.length > 0 && selSubTeams.length > 0 && selSubTeams.length < subTeamNames.length;
                            const subFullCheck   = subSelected && (subTeamNames.length === 0 || selSubTeams.length === subTeamNames.length);
                            return (
                              <div key={subOrg.id} className="border-b border-gray-010/50 last:border-0">
                                {/* 부조직 행 */}
                                <button type="button" onClick={() => toggleSubOrg(dept, subOrg.name)}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-pink-005/50 transition-colors">
                                  <span className="w-3 flex-shrink-0" />
                                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                                    (subFullCheck || subIndeterm) ? 'bg-pink-040' : 'border-2 border-gray-030 bg-white'
                                  }`}>
                                    {subFullCheck && <MsCheckIcon size={9} className="text-white" />}
                                    {subIndeterm  && <span className="text-white font-bold text-xs leading-none select-none">−</span>}
                                  </div>
                                  <span className={`flex-1 text-sm ${subSelected ? 'text-gray-080' : 'text-gray-035'}`}>{subOrg.name}</span>
                                  <span className="text-xs text-gray-040">{subCount}명</span>
                                </button>

                                {/* 팀 */}
                                {subSelected && subTeams.length > 0 && (
                                  <div className="bg-gray-005/50">
                                    {subTeams.map(team => {
                                      const teamSelected  = form.targetTeams.includes(team.name);
                                      const teamCount     = users.filter(u => u.team === team.name && u.role !== 'admin').length;
                                      const squads        = teamSquadsMap[team.name] ?? [];
                                      const squadNames    = squads.map(o => o.name);
                                      const selSquads     = form.targetSquads.filter(s => squadNames.includes(s));
                                      const teamIndeterm  = teamSelected && squadNames.length > 0 && selSquads.length > 0 && selSquads.length < squadNames.length;
                                      const teamFullCheck = teamSelected && (squadNames.length === 0 || selSquads.length === squadNames.length);
                                      return (
                                        <div key={team.id} className="border-t border-gray-010/50">
                                          {/* 팀 행 */}
                                          <button type="button" onClick={() => toggleTeam(dept, subOrg.name, team.name)}
                                            className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-pink-005/30 transition-colors">
                                            <span className="w-7 flex-shrink-0" />
                                            <div className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 ${
                                              (teamFullCheck || teamIndeterm) ? 'bg-pink-040' : 'border-2 border-gray-030 bg-white'
                                            }`}>
                                              {teamFullCheck && <MsCheckIcon size={8} className="text-white" />}
                                              {teamIndeterm  && <span className="text-white font-bold text-[9px] leading-none select-none">−</span>}
                                            </div>
                                            <span className={`flex-1 text-xs ${teamSelected ? 'text-gray-070' : 'text-gray-030'}`}>{team.name}</span>
                                            <span className="text-[11px] text-gray-040">{teamCount}명</span>
                                          </button>

                                          {/* 스쿼드 */}
                                          {teamSelected && squads.length > 0 && (
                                            <div className="bg-gray-005">
                                              {squads.map(squad => {
                                                const sqSelected = form.targetSquads.includes(squad.name);
                                                const sqCount    = users.filter(u => u.squad === squad.name && u.role !== 'admin').length;
                                                return (
                                                  <button key={squad.id} type="button"
                                                    onClick={() => toggleSquad(dept, subOrg.name, team.name, squad.name)}
                                                    className="w-full flex items-center gap-3 px-4 py-1.5 text-left hover:bg-pink-005/20 transition-colors border-t border-gray-010/30">
                                                    <span className="w-12 flex-shrink-0" />
                                                    <div className={`w-3 h-3 rounded flex items-center justify-center flex-shrink-0 ${
                                                      sqSelected ? 'bg-pink-040' : 'border-2 border-gray-030 bg-white'
                                                    }`}>
                                                      {sqSelected && <MsCheckIcon size={7} className="text-white" />}
                                                    </div>
                                                    <span className={`flex-1 text-[11px] ${sqSelected ? 'text-gray-060' : 'text-gray-030'}`}>{squad.name}</span>
                                                    <span className="text-[10px] text-gray-040">{sqCount}명</span>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

          </div>
        )}

        {/* Step 3: 일정 */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-099">일정을 설정하세요</h2>
            {[
              { key: 'selfReviewDeadline',    label: '자기평가 마감일',       required: true  },
              { key: 'managerReviewDeadline', label: '매니저 리뷰 마감일',    required: true  },
              { key: 'calibrationDeadline',   label: '조율 마감일 (선택)',    required: false },
            ].map(({ key, label, required }) => {
              const hasErr = key === 'managerReviewDeadline' && !!formErrors.managerReviewDeadline;
              return (
                <MsInput
                  key={key}
                  label={required ? `${label} *` : label}
                  type="date"
                  value={form[key as keyof FormState] as string}
                  onChange={e => {
                    setForm(f => ({ ...f, [key]: e.target.value }));
                    if (key === 'managerReviewDeadline') clearError('managerReviewDeadline');
                  }}
                  onBlur={() => { if (key === 'managerReviewDeadline') touch('managerReviewDeadline'); }}
                  error={hasErr ? formErrors.managerReviewDeadline : undefined}
                />
              );
            })}

            <AutomationSection form={form} setForm={setForm} />
          </div>
        )}

        {/* Step 4: 정책 */}
        {step === 4 && (
          <PolicySection form={form} setForm={setForm} />
        )}

        {/* Step 5: 최종 검토 */}
        {step === 5 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-099">최종 검토 후 발행하세요</h2>
            <div className="space-y-0">
              {[
                { label: '리뷰 이름',        value: form.title },
                { label: '유형',             value: form.type === 'scheduled' ? '정기 리뷰' : '수시 리뷰' },
                { label: '템플릿',           value: selectedTemplate?.name ?? '-' },
                { label: '대상 부서',   value: form.targetDepartments.join(', ') || '-' },
                { label: '하위 조직',   value: form.targetSubOrgs.length > 0 ? form.targetSubOrgs.join(', ') : '전체' },
                ...(form.targetTeams.length > 0 ? [{ label: '팀', value: form.targetTeams.join(', ') }] : []),
                ...(form.targetSquads.length > 0 ? [{ label: '스쿼드', value: form.targetSquads.join(', ') }] : []),
                { label: '대상 구성원', value: `${targetMembers.length}명` },
                { label: '자기평가',         value: `${selfCount}건 생성` },
                { label: '매니저 평가',      value: `${downCount}건 생성` },
                { label: '자기평가 마감',    value: form.selfReviewDeadline },
                { label: '매니저 평가 마감', value: form.managerReviewDeadline },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-3 py-2.5 border-b border-gray-010 last:border-0">
                  <span className="text-xs text-gray-050 w-32 flex-shrink-0">{label}</span>
                  <span className="text-sm text-gray-080 font-medium">{value}</span>
                </div>
              ))}
            </div>

            {/* 템플릿 문항 미리보기 (접기/펼치기) */}
            {selectedTemplate && (
              <div className="border border-gray-020 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTemplatePreviewOpen(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-005 hover:bg-gray-010 transition-colors text-sm font-medium text-gray-070"
                >
                  <span>템플릿 문항 전체 보기 ({selectedTemplate.questions.length}개)</span>
                  <MsChevronDownLineIcon size={16} className={`text-gray-040 transition-transform ${templatePreviewOpen ? 'rotate-180' : ''}`} />
                </button>
                {templatePreviewOpen && (
                  <div className="divide-y divide-gray-010">
                    {selectedTemplate.questions.map((q, idx) => (
                      <div key={q.id} className="px-4 py-3 space-y-1.5">
                        <div className="flex items-start gap-2">
                          <span className="text-xs text-gray-040 w-5 flex-shrink-0 mt-0.5">{idx + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-080">{q.text}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                q.type === 'text' ? 'bg-blue-50 text-blue-600'
                                : q.type === 'rating' ? 'bg-amber-50 text-amber-600'
                                : q.type === 'competency' ? 'bg-purple-50 text-purple-600'
                                : 'bg-green-50 text-green-600'
                              }`}>
                                {TYPE_LABEL[q.type] ?? q.type}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${q.target === 'self' ? 'bg-gray-010 text-gray-050' : q.target === 'leader' ? 'bg-orange-50 text-orange-600' : 'bg-teal-50 text-teal-600'}`}>
                                {q.target === 'self' ? '자기평가' : q.target === 'leader' ? '리더 평가' : '공통'}
                              </span>
                              {q.isPrivate && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-010 text-gray-040">비공개</span>}
                              {q.isRequired && <span className="text-xs text-red-040">필수</span>}
                            </div>
                            {q.type === 'rating' && q.ratingScale && (
                              <p className="text-xs text-gray-040 mt-1">{q.ratingScale}점 척도</p>
                            )}
                            {q.type === 'multiple_choice' && q.options && q.options.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {q.options.map((opt, oi) => (
                                  <span key={oi} className="text-xs bg-gray-010 text-gray-060 px-2 py-0.5 rounded">{opt}</span>
                                ))}
                                {q.allowMultiple && <span className="text-xs text-green-600 ml-1">복수 선택 가능</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="p-4 bg-pink-005 border border-pink-010 rounded-xl">
              <p className="text-sm font-semibold text-pink-060 mb-1 flex items-center gap-2">
                <Rocket className="w-4 h-4" /> 발행하면 즉시 시작됩니다
              </p>
              <p className="text-xs text-pink-050">
                {targetMembers.length}명의 자기평가 + {downCount}건의 매니저 평가가 자동으로 배정됩니다.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 네비게이션 */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-gray-010 px-5 py-4">
        <MsButton
          variant="ghost"
          leftIcon={<MsChevronLeftLineIcon size={16} />}
          onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/cycles')}
        >
          {step === 0 ? '취소' : '이전'}
        </MsButton>

        {step < STEPS.length - 1 ? (
          step === 1 && templates.length === 0 ? (
            <MsButton type="button" onClick={handleGoCreateTemplate} leftIcon={<MsPlusIcon size={16} />}>템플릿 만들기</MsButton>
          ) : (
            <MsButton
              onClick={async () => {
                if (step === 0) { touch('title'); if (!canNext()) return; }
                if (step === 3) { touch('managerReviewDeadline'); if (!canNext()) return; }
                resetErrors();
                await persistDraftAndAdvance();
              }}
              disabled={!canNext() || saving}
              loading={saving}
              rightIcon={<MsChevronRightLineIcon size={16} />}
            >
              저장 후 다음
            </MsButton>
          )
        ) : (
          <>
          <MsButton
            variant="outline-default"
            onClick={() => setDryRunOpen(true)}
            disabled={usersLoading || targetMembers.length === 0}
            leftIcon={<Eye className="w-4 h-4" />}
          >
            드라이런 프리뷰
          </MsButton>
          <MsButton
            onClick={openPreflight}
            disabled={usersLoading || targetMembers.length === 0}
            className="bg-green-060 hover:bg-green-060"
            leftIcon={<Rocket className="w-4 h-4" />}
          >
            {usersLoading ? '구성원 로딩 중...' : targetMembers.length === 0 ? '대상 구성원 없음' : '사전 점검 후 발행'}
          </MsButton>
          </>
        )}
      </div>

      <PreflightModal
        open={preflightOpen}
        onClose={() => setPreflightOpen(false)}
        onConfirm={handlePublish}
        result={preflightResult}
        cycleTitle={form.title || '새 리뷰'}
        loading={publishing}
      />

      <DryRunModal
        open={dryRunOpen}
        onClose={() => setDryRunOpen(false)}
        cycle={{
          id: 'candidate',
          title: form.title || '새 리뷰',
          type: form.type,
          status: 'draft',
          templateId: form.templateId,
          targetDepartments: form.targetDepartments,
          selfReviewDeadline: new Date(form.selfReviewDeadline).toISOString(),
          managerReviewDeadline: new Date(form.managerReviewDeadline).toISOString(),
          createdBy: currentUser?.id ?? 'system',
          createdAt: new Date().toISOString(),
          completionRate: 0,
          tags: form.tags,
          targetMode: form.targetMode,
          targetManagerId: form.targetManagerId,
          targetUserIds: form.targetUserIds,
        }}
        title={form.title || '새 리뷰'}
      />

      {/* 레거시 발행 확인 (사전 점검 모달이 대체) */}
      {false && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-005 rounded-full flex items-center justify-center flex-shrink-0">
                <Rocket className="w-5 h-5 text-yellow-060" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-099">리뷰를 발행하시겠습니까?</h3>
                <p className="text-xs text-gray-050 mt-0.5">발행 후에는 되돌릴 수 없습니다.</p>
              </div>
            </div>
            <div className="bg-gray-005 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex gap-3">
                <span className="text-gray-040 w-28 flex-shrink-0">리뷰 이름</span>
                <span className="font-medium text-gray-080">{form.title}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-gray-040 w-28 flex-shrink-0">대상 구성원</span>
                <span className="font-medium text-gray-080">{targetMembers.length}명</span>
              </div>
              <div className="flex gap-3">
                <span className="text-gray-040 w-28 flex-shrink-0">생성될 제출 건</span>
                <span className="font-medium text-gray-080">자기평가 {selfCount}건 · 매니저 평가 {downCount}건</span>
              </div>
            </div>
            <p className="text-xs text-red-050 bg-red-005 px-3 py-2 rounded-lg">
              ⚠ 발행된 리뷰는 즉시 구성원에게 배정되며 수정이 불가합니다.
            </p>
            <div className="flex gap-3 pt-1">
              <MsButton
                variant="default"
                className="flex-1"
                onClick={() => setPreflightOpen(false)}
              >
                취소
              </MsButton>
              <MsButton
                onClick={handlePublish}
                loading={publishing}
                className="flex-1 h-auto py-2.5 bg-green-060 hover:bg-green-060"
                leftIcon={<Rocket className="w-4 h-4" />}
              >
                발행하기
              </MsButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
