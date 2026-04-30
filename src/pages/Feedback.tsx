import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useFeedbackStore } from '../stores/feedbackStore';
import { useTeamStore } from '../stores/teamStore';
import type { Feedback } from '../types';
import { useShowToast } from '../components/ui/Toast';
import { UserAvatar } from '../components/ui/UserAvatar';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDateTime } from '../utils/dateUtils';
import { Heart, Lightbulb, ThumbsUp, Lightbulb as TipIcon } from 'lucide-react';
import {
  MsMessageIcon, MsSendIcon, MsChevronLeftLineIcon, MsChevronDownLineIcon,
  MsChevronRightLineIcon, MsPlusIcon, MsSearchIcon, MsCancelIcon,
} from '../components/ui/MsIcons';
import type { FeedbackType } from '../types';
import { getSmallestOrg } from '../utils/userUtils';
import { MsButton } from '../components/ui/MsButton';
import { MsCheckbox, MsInput, MsTextarea } from '../components/ui/MsControl';

const TYPE_CONFIG: Record<FeedbackType, {
  label: string; emoji: string;
  icon: typeof Heart;
  activeClass: string; badgeClass: string;
}> = {
  praise:     { label: '칭찬',   emoji: '🌟', icon: Heart,     activeClass: 'border-green-040 bg-green-005 text-green-060', badgeClass: 'bg-green-005 text-green-060' },
  suggestion: { label: '제안',   emoji: '💡', icon: Lightbulb, activeClass: 'border-blue-040 bg-blue-005 text-blue-060',   badgeClass: 'bg-blue-005 text-blue-060'   },
  note:       { label: '일반',   emoji: '📝', icon: ThumbsUp,  activeClass: 'border-gray-040 bg-gray-010 text-gray-070',   badgeClass: 'bg-gray-010 text-gray-060'   },
};

const FEEDBACK_TIPS = [
  { title: '구체적인 상황을 언급하세요', desc: '언제, 어디서 있었던 일인지 구체적으로 적으면 더 큰 도움이 됩니다.' },
  { title: '행동에 집중하세요',          desc: '사람 자체보다 특정 행동이나 결과에 대해 작성하면 건설적인 피드백이 됩니다.' },
  { title: '영향을 함께 전달하세요',     desc: '그 행동이 팀이나 프로젝트에 어떤 영향을 미쳤는지 공유해보세요.' },
  { title: '진심을 담아 작성하세요',     desc: '형식적인 표현보다 진심 어린 한 마디가 더 큰 울림을 줍니다.' },
];

// ─── 피드백 카드 ─────────────────────────────────────────────────────────────
function FeedbackCard({ fb, mode, onQuickWrite }: {
  fb: Feedback;
  mode: 'received' | 'sent';
  onQuickWrite?: (toUserId: string) => void;
}) {
  const { users } = useTeamStore();
  const fromUser = users.find(u => u.id === fb.fromUserId);
  const toUser   = users.find(u => u.id === fb.toUserId);
  const cfg      = TYPE_CONFIG[fb.type];

  return (
    <div className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          {mode === 'received' ? (
            fb.isAnonymous ? (
              <div className="w-9 h-9 rounded-full bg-gray-020 flex items-center justify-center text-fg-subtlest text-xs font-bold flex-shrink-0">?</div>
            ) : fromUser ? (
              <UserAvatar user={fromUser} size="sm" />
            ) : null
          ) : toUser ? (
            <UserAvatar user={toUser} size="sm" />
          ) : null}
          <div>
            <p className="text-base font-semibold text-gray-080">
              {mode === 'received'
                ? (fb.isAnonymous ? '익명' : fromUser?.name)
                : toUser?.name}
            </p>
            <p className="text-xs text-fg-subtlest">{formatDateTime(fb.createdAt)}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badgeClass}`}>
          {cfg.emoji} {cfg.label}
        </span>
      </div>
      <p className="text-base text-gray-070 leading-relaxed">{fb.content}</p>
      {onQuickWrite && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => onQuickWrite(mode === 'received' ? fb.fromUserId : fb.toUserId)}
            className="text-xs text-pink-050 hover:text-pink-060 font-medium transition-colors"
          >
            {mode === 'received' ? '감사 전하기 →' : '이 사람에게 다시 보내기 →'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 피드백 보내기 화면 (3단 풀블리드) ──────────────────────────────────────
function WriteView({ initialToUserId, onBack, onSent }: {
  initialToUserId?: string;
  onBack: () => void;
  onSent: () => void;
}) {
  const { currentUser } = useAuthStore();
  const { feedbacks, addFeedback } = useFeedbackStore();
  const { users } = useTeamStore();
  const showToast = useShowToast();

  const recipients = users.filter(u => u.id !== currentUser?.id && u.isActive !== false);
  const [toUserId, setToUserId]         = useState(initialToUserId ?? '');
  const [type, setType]                 = useState<FeedbackType>('praise');
  const [content, setContent]           = useState('');
  const [isAnonymous, setAnonymous]     = useState(false);
  const [tipsOpen, setTipsOpen]         = useState(true);
  const [search, setSearch]             = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const q = search.trim().toLowerCase();
  const filteredRecipients = q
    ? recipients.filter(u =>
        u.name.toLowerCase().includes(q) ||
        (u.department ?? '').toLowerCase().includes(q) ||
        u.position.toLowerCase().includes(q),
      )
    : recipients;

  const selectedUser = users.find(u => u.id === toUserId);
  const recentWithUser = feedbacks.filter(
    f => (f.fromUserId === currentUser?.id && f.toUserId === toUserId)
      || (f.toUserId === currentUser?.id && f.fromUserId === toUserId)
  ).slice(0, 5);

  const handleSubmit = () => {
    if (!toUserId)                    { showToast('error', '받는 사람을 선택해주세요.'); return; }
    if (content.trim().length < 10)  { showToast('error', '10자 이상 작성해주세요.'); return; }
    if (!currentUser) return;

    addFeedback({
      id: `fb_${Date.now()}`,
      fromUserId: currentUser.id,
      toUserId,
      type,
      content: content.trim(),
      isAnonymous,
      createdAt: new Date().toISOString(),
    });
    showToast('success', '피드백을 전달했습니다! 🎉');
    onSent();
  };

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── 좌: 수신자 선택 ── */}
      <div className="hidden md:flex w-64 bg-white border-r border-gray-010 flex-col flex-shrink-0">
        {/* 뒤로가기 */}
        <div className="px-4 py-4 border-b border-gray-010">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-base text-fg-subtle hover:text-gray-080 transition-colors"
          >
            <MsChevronLeftLineIcon size={16} className="w-4 h-4" /> 피드백 목록
          </button>
        </div>

        {/* 검색 */}
        <div className="px-3 py-2 border-b border-gray-010">
          <MsInput
            size="sm"
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름, 부서 검색..."
            leftSlot={<MsSearchIcon size={12} />}
            rightSlot={search ? (
              <button onClick={() => setSearch('')} className="text-fg-subtlest hover:text-gray-060 transition-colors">
                <MsCancelIcon size={12} />
              </button>
            ) : undefined}
          />
        </div>

        {/* 수신자 목록 */}
        <div className="flex-1 overflow-y-auto">
          <p className="text-xs font-semibold text-fg-subtlest uppercase tracking-wider px-4 py-3">받는 사람</p>
          {filteredRecipients.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-fg-subtlest">검색 결과가 없습니다.</p>
            </div>
          ) : filteredRecipients.map(user => {
            const isSel = toUserId === user.id;
            return (
              <button
                key={user.id}
                onClick={() => setToUserId(user.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                  isSel
                    ? 'bg-pink-005 border-r-2 border-pink-040'
                    : 'hover:bg-gray-005'
                }`}
              >
                <UserAvatar user={user} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className={`text-base font-medium truncate ${isSel ? 'text-pink-060' : 'text-gray-080'}`}>
                    {user.name}
                  </p>
                  <p className="text-xs text-fg-subtlest truncate">{getSmallestOrg(user)} · {user.position}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* 최근 대화 */}
        {selectedUser && recentWithUser.length > 0 && (
          <div className="border-t border-gray-010 p-3">
            <p className="text-xs font-semibold text-fg-subtlest uppercase tracking-wider mb-2 px-1">
              {selectedUser.name}님과 최근 피드백
            </p>
            <div className="space-y-1.5">
              {recentWithUser.map(fb => {
                const isMine = fb.fromUserId === currentUser?.id;
                const cfg = TYPE_CONFIG[fb.type];
                return (
                  <div key={fb.id} className="p-2 bg-gray-005 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs">{cfg.emoji}</span>
                      <span className={`text-xs font-medium ${isMine ? 'text-pink-050' : 'text-fg-subtle'}`}>
                        {isMine ? '내가 보냄' : '받음'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-060 line-clamp-2 leading-relaxed">{fb.content}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── 중: 작성 폼 ── */}
      <div className="flex-1 overflow-y-auto bg-gray-005">
        {/* 모바일 수신자 선택 */}
        <div className="md:hidden px-4 py-3 bg-white border-b border-gray-010 sticky top-0 z-20">
          {selectedUser ? (
            <div className="flex items-center gap-2.5 px-3 py-2 bg-blue-005 rounded-lg border border-blue-020">
              <UserAvatar user={selectedUser} size="sm" />
              <span className="flex-1 text-base font-medium text-blue-060 truncate">{selectedUser.name}</span>
              <span className="text-xs text-blue-040 truncate hidden sm:block">{selectedUser.department}</span>
              <button
                onClick={() => { setToUserId(''); setSearch(''); }}
                className="text-blue-040 hover:text-pink-050 transition-colors flex-shrink-0"
                aria-label="선택 해제"
              >
                <MsCancelIcon size={16} className="size-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <MsInput
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setMobileSearchOpen(true); }}
                onFocus={() => setMobileSearchOpen(true)}
                placeholder="받는 사람 검색..."
                leftSlot={<MsSearchIcon size={16} />}
              />
              {mobileSearchOpen && filteredRecipients.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-020 rounded-xl shadow-lg z-50 max-h-52 overflow-y-auto">
                  {filteredRecipients.map(u => (
                    <button
                      key={u.id}
                      onMouseDown={() => { setToUserId(u.id); setSearch(''); setMobileSearchOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-pink-005 transition-colors text-left"
                    >
                      <UserAvatar user={u} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-medium text-gray-080 truncate">{u.name}</p>
                        <p className="text-xs text-fg-subtlest truncate">{getSmallestOrg(u)} · {u.position}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-6 space-y-6 max-w-2xl mx-auto">
          {/* 수신자 프리뷰 */}
          {selectedUser ? (
            <div className="flex items-center gap-3 p-4 rounded-lg border border-bd-default">
              <UserAvatar user={selectedUser} size="xl" />
              <div>
                <p className="text-base font-semibold text-fg-default">{selectedUser.name}</p>
                <p className="text-base text-fg-subtlest">{selectedUser.position} · {getSmallestOrg(selectedUser)}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 p-4 rounded-lg border border-dashed border-gray-030">
              <p className="text-base text-fg-subtlest">← 왼쪽에서 받는 사람을 선택하세요</p>
            </div>
          )}

          {/* 유형 선택 */}
          <div>
            <p className="text-xs font-semibold text-gray-060 uppercase tracking-wider mb-3">피드백 유형</p>
            <div className="flex gap-3">
              {(Object.entries(TYPE_CONFIG) as [FeedbackType, typeof TYPE_CONFIG['praise']][]).map(([key, cfg]) => {
                const isActive = type === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 text-base font-medium transition-all ${
                      isActive ? cfg.activeClass : 'border-gray-020 text-fg-subtle hover:border-gray-030 bg-white'
                    }`}
                  >
                    <span className="text-xl">{cfg.emoji}</span>
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 내용 */}
          <div>
            <p className="text-xs font-semibold text-gray-060 uppercase tracking-wider mb-3">내용 *</p>
            <MsTextarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              maxLength={500}
              placeholder="구체적인 상황과 행동을 포함해 작성하면 더 큰 도움이 됩니다."
            />
            <div className="flex justify-between mt-1.5">
              {content.length > 0 && content.length < 10 && (
                <p className="text-xs text-red-040">10자 이상 작성해주세요.</p>
              )}
              {content.length >= 10 && (
                <p className="text-xs text-green-060">잘 작성하고 계십니다!</p>
              )}
              {content.length === 0 && <span />}
              <p className="text-xs text-fg-subtlest ml-auto">{content.length}/500</p>
            </div>
          </div>

          {/* 익명 + 전송 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <MsCheckbox
                checked={isAnonymous}
                onChange={e => setAnonymous(e.target.checked)}
                label="익명으로 보내기"
              />
              <span className="text-xs text-fg-subtlest hidden sm:inline">(받는 사람이 보낸 사람을 알 수 없습니다)</span>
            </div>
          </div>
        </div>

        {/* 하단 제출 바 */}
        <div className="sticky bottom-0 px-6 pb-6 max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-gray-010 px-4 py-3 shadow-raised flex items-center justify-between">
            <p className="text-xs text-fg-subtlest">
              {selectedUser ? `${selectedUser.name}님에게 ${TYPE_CONFIG[type].emoji} ${TYPE_CONFIG[type].label} 피드백` : '받는 사람을 선택하세요'}
            </p>
            <MsButton onClick={handleSubmit} disabled={!toUserId || content.trim().length < 10} leftIcon={<MsSendIcon size={16} />}>피드백 보내기</MsButton>
          </div>
        </div>
      </div>

      {/* ── 우: 작성 가이드 ── */}
      <div className="hidden lg:flex w-64 bg-white border-l border-gray-010 flex-col flex-shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-gray-010">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded bg-yellow-005 flex items-center justify-center flex-shrink-0">
              <TipIcon className="size-3.5 text-yellow-060" />
            </div>
            <p className="text-xs font-semibold text-fg-default">작성 가이드</p>
          </div>
        </div>

        {/* 팁 아코디언 */}
        <button
          onClick={() => setTipsOpen(v => !v)}
          className="flex items-center justify-between px-4 py-3 hover:bg-gray-005 transition-colors border-b border-gray-010"
        >
          <span className="text-xs font-medium text-gray-070">좋은 피드백 작성법</span>
          {tipsOpen ? <MsChevronDownLineIcon size={12} className="text-fg-subtlest" /> : <MsChevronRightLineIcon size={12} className="text-fg-subtlest" />}
        </button>
        {tipsOpen && (
          <ul className="px-4 py-3 space-y-3">
            {FEEDBACK_TIPS.map((tip, i) => (
              <li key={i} className="space-y-0.5">
                <p className="text-xs font-semibold text-gray-070">{tip.title}</p>
                <p className="text-xs text-fg-subtle leading-relaxed">{tip.desc}</p>
              </li>
            ))}
          </ul>
        )}

        {/* 유형별 예시 */}
        <div className="border-t border-gray-010 p-4 space-y-3">
          <p className="text-xs font-semibold text-fg-subtlest uppercase tracking-wider">유형별 예시</p>
          <div className="space-y-2.5">
            <div className="p-2.5 bg-green-005 rounded-lg">
              <p className="text-xs font-semibold text-green-060 mb-1">🌟 칭찬 예시</p>
              <p className="text-xs text-green-050 leading-relaxed">"지난 스프린트에서 API 병목 문제를 신속하게 발견하고 해결해 팀 전체 일정을 지킬 수 있었습니다."</p>
            </div>
            <div className="p-2.5 bg-blue-005 rounded-lg">
              <p className="text-xs font-semibold text-blue-060 mb-1">💡 제안 예시</p>
              <p className="text-xs text-blue-050 leading-relaxed">"회의 전 안건을 미리 공유해 주시면 더 효율적인 논의가 될 것 같습니다."</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function Feedback() {
  const { currentUser } = useAuthStore();
  const { feedbacks } = useFeedbackStore();

  const [tab, setTab]             = useState<'received' | 'sent'>('received');
  const [showWrite, setShowWrite] = useState(false);
  const [writeToId, setWriteToId] = useState<string | undefined>(undefined);

  const received = feedbacks.filter(f => f.toUserId === currentUser?.id);
  const sent     = feedbacks.filter(f => f.fromUserId === currentUser?.id);

  const goToWrite = (toUserId?: string) => {
    setWriteToId(toUserId);
    setShowWrite(true);
  };

  // ── 작성 화면 (풀블리드) ──
  if (showWrite) {
    return (
      <WriteView
        initialToUserId={writeToId}
        onBack={() => setShowWrite(false)}
        onSent={() => { setShowWrite(false); setTab('sent'); }}
      />
    );
  }

  // ── 목록 화면 ──
  const TABS = [
    { key: 'received' as const, label: '받은 피드백', count: received.length },
    { key: 'sent'     as const, label: '보낸 피드백', count: sent.length },
  ];

  const items = tab === 'received' ? received : sent;

  return (
    <div className="flex flex-1 overflow-y-auto">
      <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-5">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-fg-default">피드백</h1>
          <MsButton onClick={() => goToWrite()} leftIcon={<MsPlusIcon size={16} />}>피드백 보내기</MsButton>
        </div>

        {/* 세그먼트 필터 */}
        <div className="flex items-center gap-1 bg-white rounded-lg border border-bd-default p-1 w-fit">
          {TABS.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-base font-medium transition-colors ${
                tab === key
                  ? 'bg-gray-099 text-white shadow-sm'
                  : 'text-fg-subtle hover:text-gray-080 hover:bg-gray-005'
              }`}
            >
              {label}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full leading-none ${
                tab === key ? 'bg-white/20 text-white' : 'bg-gray-010 text-fg-subtle'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* 목록 */}
        {items.length === 0 ? (
          <EmptyState
            icon={MsMessageIcon}
            title={tab === 'received' ? '아직 받은 피드백이 없습니다.' : '아직 보낸 피드백이 없습니다.'}
            description={tab === 'received' ? '동료들에게 먼저 피드백을 보내보세요!' : '동료에게 진심 어린 피드백을 전달해보세요.'}
          />
        ) : (
          <div className="space-y-3">
            {items.map(fb => (
              <FeedbackCard
                key={fb.id}
                fb={fb}
                mode={tab}
                onQuickWrite={
                  tab === 'received' && !fb.isAnonymous
                    ? (id) => goToWrite(id)
                    : tab === 'sent'
                      ? (id) => goToWrite(id)
                      : undefined
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
