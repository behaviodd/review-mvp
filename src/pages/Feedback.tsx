import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useFeedbackStore } from '../stores/feedbackStore';
import { useShowToast } from '../components/ui/Toast';
import { MOCK_USERS } from '../data/mockData';
import { UserAvatar } from '../components/ui/UserAvatar';
import { EmptyState } from '../components/ui/EmptyState';
import { formatDateTime } from '../utils/dateUtils';
import {
  MessageSquare, Send, Heart, Lightbulb, ThumbsUp,
  ChevronLeft, Lightbulb as TipIcon, ChevronDown, ChevronRight,
  Plus, Search, X,
} from 'lucide-react';
import type { FeedbackType } from '../types';

const TYPE_CONFIG: Record<FeedbackType, {
  label: string; emoji: string;
  icon: typeof Heart;
  activeClass: string; badgeClass: string;
}> = {
  praise:     { label: '칭찬',   emoji: '🌟', icon: Heart,     activeClass: 'border-emerald-400 bg-emerald-50 text-emerald-700', badgeClass: 'bg-emerald-50 text-emerald-700' },
  suggestion: { label: '제안',   emoji: '💡', icon: Lightbulb, activeClass: 'border-indigo-400 bg-indigo-50 text-indigo-700',   badgeClass: 'bg-indigo-50 text-indigo-700'   },
  note:       { label: '일반',   emoji: '📝', icon: ThumbsUp,  activeClass: 'border-zinc-400 bg-zinc-100 text-zinc-700',        badgeClass: 'bg-zinc-100 text-zinc-600'      },
};

const FEEDBACK_TIPS = [
  { title: '구체적인 상황을 언급하세요', desc: '언제, 어디서 있었던 일인지 구체적으로 적으면 더 큰 도움이 됩니다.' },
  { title: '행동에 집중하세요',          desc: '사람 자체보다 특정 행동이나 결과에 대해 작성하면 건설적인 피드백이 됩니다.' },
  { title: '영향을 함께 전달하세요',     desc: '그 행동이 팀이나 프로젝트에 어떤 영향을 미쳤는지 공유해보세요.' },
  { title: '진심을 담아 작성하세요',     desc: '형식적인 표현보다 진심 어린 한 마디가 더 큰 울림을 줍니다.' },
];

// ─── 피드백 카드 ─────────────────────────────────────────────────────────────
function FeedbackCard({ fb, mode, onQuickWrite }: {
  fb: ReturnType<typeof useFeedbackStore>['feedbacks'][0];
  mode: 'received' | 'sent';
  onQuickWrite?: (toUserId: string) => void;
}) {
  const fromUser = MOCK_USERS.find(u => u.id === fb.fromUserId);
  const toUser   = MOCK_USERS.find(u => u.id === fb.toUserId);
  const cfg      = TYPE_CONFIG[fb.type];

  return (
    <div className="bg-white rounded-xl border border-zinc-950/5 shadow-card p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          {mode === 'received' ? (
            fb.isAnonymous ? (
              <div className="w-9 h-9 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-400 text-xs font-bold flex-shrink-0">?</div>
            ) : fromUser ? (
              <UserAvatar user={fromUser} size="sm" />
            ) : null
          ) : toUser ? (
            <UserAvatar user={toUser} size="sm" />
          ) : null}
          <div>
            <p className="text-sm font-semibold text-zinc-800">
              {mode === 'received'
                ? (fb.isAnonymous ? '익명' : fromUser?.name)
                : toUser?.name}
            </p>
            <p className="text-xs text-zinc-400">{formatDateTime(fb.createdAt)}</p>
          </div>
        </div>
        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badgeClass}`}>
          {cfg.emoji} {cfg.label}
        </span>
      </div>
      <p className="text-sm text-zinc-700 leading-relaxed">{fb.content}</p>
      {onQuickWrite && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => onQuickWrite(mode === 'received' ? fb.fromUserId : fb.toUserId)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
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
  const showToast = useShowToast();

  const recipients = MOCK_USERS.filter(u => u.id !== currentUser?.id);
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
        u.department.toLowerCase().includes(q) ||
        u.position.toLowerCase().includes(q),
      )
    : recipients;

  const selectedUser = MOCK_USERS.find(u => u.id === toUserId);
  const recentWithUser = feedbacks.filter(
    f => (f.fromUserId === currentUser?.id && f.toUserId === toUserId)
      || (f.toUserId === currentUser?.id && f.fromUserId === toUserId)
  ).slice(0, 5);

  const handleSubmit = () => {
    if (!toUserId)                    { showToast('받는 사람을 선택해주세요.', 'error'); return; }
    if (content.trim().length < 10)  { showToast('10자 이상 작성해주세요.', 'error'); return; }
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
    showToast('피드백을 전달했습니다! 🎉', 'success');
    onSent();
  };

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── 좌: 수신자 선택 ── */}
      <div className="hidden md:flex w-64 bg-white border-r border-zinc-950/5 flex-col flex-shrink-0">
        {/* 뒤로가기 */}
        <div className="px-4 py-4 border-b border-zinc-950/5">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> 피드백 목록
          </button>
        </div>

        {/* 검색 */}
        <div className="px-3 py-2 border-b border-zinc-950/5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="이름, 부서 검색..."
              className="w-full pl-7 pr-7 py-1.5 text-xs border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 focus:bg-white placeholder:text-zinc-300"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        {/* 수신자 목록 */}
        <div className="flex-1 overflow-y-auto">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider px-4 py-3">받는 사람</p>
          {filteredRecipients.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-zinc-400">검색 결과가 없습니다.</p>
            </div>
          ) : filteredRecipients.map(user => {
            const isSel = toUserId === user.id;
            return (
              <button
                key={user.id}
                onClick={() => setToUserId(user.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                  isSel
                    ? 'bg-indigo-50 border-r-2 border-indigo-500'
                    : 'hover:bg-zinc-50'
                }`}
              >
                <UserAvatar user={user} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isSel ? 'text-indigo-700' : 'text-zinc-800'}`}>
                    {user.name}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate">{user.department} · {user.position}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* 최근 대화 */}
        {selectedUser && recentWithUser.length > 0 && (
          <div className="border-t border-zinc-950/5 p-3">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-1">
              {selectedUser.name}님과 최근 피드백
            </p>
            <div className="space-y-1.5">
              {recentWithUser.map(fb => {
                const isMine = fb.fromUserId === currentUser?.id;
                const cfg = TYPE_CONFIG[fb.type];
                return (
                  <div key={fb.id} className="p-2 bg-zinc-50 rounded-lg">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px]">{cfg.emoji}</span>
                      <span className={`text-[10px] font-medium ${isMine ? 'text-indigo-600' : 'text-zinc-500'}`}>
                        {isMine ? '내가 보냄' : '받음'}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-600 line-clamp-2 leading-relaxed">{fb.content}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── 중: 작성 폼 ── */}
      <div className="flex-1 overflow-y-auto bg-neutral-50">
        {/* 모바일 수신자 선택 */}
        <div className="md:hidden px-4 py-3 bg-white border-b border-zinc-950/5 sticky top-0 z-20">
          {selectedUser ? (
            <div className="flex items-center gap-2.5 px-3 py-2 bg-indigo-50 rounded-lg border border-indigo-200">
              <UserAvatar user={selectedUser} size="sm" />
              <span className="flex-1 text-sm font-medium text-indigo-700 truncate">{selectedUser.name}</span>
              <span className="text-xs text-indigo-400 truncate hidden sm:block">{selectedUser.department}</span>
              <button
                onClick={() => { setToUserId(''); setSearch(''); }}
                className="text-indigo-400 hover:text-indigo-600 transition-colors flex-shrink-0"
                aria-label="선택 해제"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setMobileSearchOpen(true); }}
                onFocus={() => setMobileSearchOpen(true)}
                placeholder="받는 사람 검색..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-zinc-200 rounded-lg bg-zinc-50 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 focus:bg-white placeholder:text-zinc-300"
              />
              {mobileSearchOpen && filteredRecipients.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 max-h-52 overflow-y-auto">
                  {filteredRecipients.map(u => (
                    <button
                      key={u.id}
                      onMouseDown={() => { setToUserId(u.id); setSearch(''); setMobileSearchOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 transition-colors text-left"
                    >
                      <UserAvatar user={u} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-800 truncate">{u.name}</p>
                        <p className="text-xs text-zinc-400 truncate">{u.department} · {u.position}</p>
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
            <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-zinc-950/5 shadow-card">
              <UserAvatar user={selectedUser} size="xl" />
              <div>
                <p className="text-base font-semibold text-zinc-950">{selectedUser.name}</p>
                <p className="text-sm text-zinc-400">{selectedUser.position} · {selectedUser.department}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl border border-dashed border-zinc-300">
              <p className="text-sm text-zinc-400">← 왼쪽에서 받는 사람을 선택하세요</p>
            </div>
          )}

          {/* 유형 선택 */}
          <div>
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-3">피드백 유형</p>
            <div className="flex gap-3">
              {(Object.entries(TYPE_CONFIG) as [FeedbackType, typeof TYPE_CONFIG['praise']][]).map(([key, cfg]) => {
                const Icon = cfg.icon;
                const isActive = type === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key)}
                    className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 text-sm font-medium transition-all ${
                      isActive ? cfg.activeClass : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 bg-white'
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
            <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-3">내용 *</p>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              maxLength={500}
              placeholder="구체적인 상황과 행동을 포함해 작성하면 더 큰 도움이 됩니다."
              className="w-full px-4 py-3 border border-zinc-200 rounded-xl bg-white text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 placeholder:text-zinc-300 resize-none"
            />
            <div className="flex justify-between mt-1.5">
              {content.length > 0 && content.length < 10 && (
                <p className="text-xs text-rose-500">10자 이상 작성해주세요.</p>
              )}
              {content.length >= 10 && (
                <p className="text-xs text-emerald-600">잘 작성하고 계십니다!</p>
              )}
              {content.length === 0 && <span />}
              <p className="text-xs text-zinc-400 ml-auto">{content.length}/500</p>
            </div>
          </div>

          {/* 익명 + 전송 */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={e => setAnonymous(e.target.checked)}
                className="w-4 h-4 rounded accent-indigo-500"
              />
              <span className="text-sm text-zinc-700">익명으로 보내기</span>
              <span className="text-xs text-zinc-400 hidden sm:inline">(받는 사람이 보낸 사람을 알 수 없습니다)</span>
            </label>
          </div>
        </div>

        {/* 하단 제출 바 */}
        <div className="sticky bottom-0 px-6 pb-6 max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-zinc-950/5 px-4 py-3 shadow-raised flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              {selectedUser ? `${selectedUser.name}님에게 ${TYPE_CONFIG[type].emoji} ${TYPE_CONFIG[type].label} 피드백` : '받는 사람을 선택하세요'}
            </p>
            <button
              onClick={handleSubmit}
              disabled={!toUserId || content.trim().length < 10}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" /> 피드백 보내기
            </button>
          </div>
        </div>
      </div>

      {/* ── 우: 작성 가이드 ── */}
      <div className="hidden lg:flex w-64 bg-white border-l border-zinc-950/5 flex-col flex-shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-zinc-950/5">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded bg-amber-50 flex items-center justify-center flex-shrink-0">
              <TipIcon className="size-3.5 text-amber-500" />
            </div>
            <p className="text-xs font-semibold text-zinc-950">작성 가이드</p>
          </div>
        </div>

        {/* 팁 아코디언 */}
        <button
          onClick={() => setTipsOpen(v => !v)}
          className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors border-b border-zinc-950/5"
        >
          <span className="text-xs font-medium text-zinc-700">좋은 피드백 작성법</span>
          {tipsOpen ? <ChevronDown className="size-3.5 text-zinc-400" /> : <ChevronRight className="size-3.5 text-zinc-400" />}
        </button>
        {tipsOpen && (
          <ul className="px-4 py-3 space-y-3">
            {FEEDBACK_TIPS.map((tip, i) => (
              <li key={i} className="space-y-0.5">
                <p className="text-xs font-semibold text-zinc-700">{tip.title}</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{tip.desc}</p>
              </li>
            ))}
          </ul>
        )}

        {/* 유형별 예시 */}
        <div className="border-t border-zinc-950/5 p-4 space-y-3">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">유형별 예시</p>
          <div className="space-y-2.5">
            <div className="p-2.5 bg-emerald-50 rounded-lg">
              <p className="text-[10px] font-semibold text-emerald-700 mb-1">🌟 칭찬 예시</p>
              <p className="text-[11px] text-emerald-600 leading-relaxed">"지난 스프린트에서 API 병목 문제를 신속하게 발견하고 해결해 팀 전체 일정을 지킬 수 있었습니다."</p>
            </div>
            <div className="p-2.5 bg-indigo-50 rounded-lg">
              <p className="text-[10px] font-semibold text-indigo-700 mb-1">💡 제안 예시</p>
              <p className="text-[11px] text-indigo-600 leading-relaxed">"회의 전 안건을 미리 공유해 주시면 더 효율적인 논의가 될 것 같습니다."</p>
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
          <h1 className="text-xl font-semibold text-zinc-900">피드백</h1>
          <button
            onClick={() => goToWrite()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> 피드백 보내기
          </button>
        </div>

        {/* 세그먼트 필터 */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-zinc-950/5 shadow-card p-1 w-fit">
          {TABS.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === key
                  ? 'bg-zinc-950 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50'
              }`}
            >
              {label}
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full leading-none ${
                tab === key ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* 목록 */}
        {items.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
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
