import { useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { MsCancelIcon, MsPlusIcon } from '../ui/MsIcons';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  disabled?: boolean;
}

// 해시 → 색상 (tailwind 클래스)
const COLOR_POOL = [
  'bg-pink-005 text-pink-060 border-pink-010',
  'bg-blue-005 text-blue-070 border-blue-010',
  'bg-green-005 text-green-070 border-green-020',
  'bg-orange-005 text-orange-070 border-orange-020',
  'bg-purple-005 text-purple-060 border-purple-010',
  'bg-yellow-005 text-yellow-070 border-yellow-060/20',
];

export function tagColor(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return COLOR_POOL[h % COLOR_POOL.length];
}

export function TagInput({ value, onChange, suggestions = [], placeholder = '태그 입력 후 Enter', disabled }: Props) {
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const add = (raw: string) => {
    const t = raw.trim().replace(/^#/, '');
    if (!t) return;
    if (value.includes(t)) return;
    onChange([...value, t]);
    setDraft('');
  };

  const remove = (t: string) => onChange(value.filter(x => x !== t));

  const onKey: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      remove(value[value.length - 1]);
    }
  };

  const availableSuggestions = suggestions
    .filter(s => !value.includes(s))
    .filter(s => !draft || s.toLowerCase().includes(draft.toLowerCase()))
    .slice(0, 8);

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-colors',
          disabled ? 'bg-gray-005 border-gray-010' : 'bg-white border-gray-020 focus-within:border-pink-040',
        )}
      >
        {value.map(t => (
          <span
            key={t}
            className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold', tagColor(t))}
          >
            #{t}
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(t)}
                className="rounded-full p-0.5 opacity-70 hover:opacity-100"
                aria-label={`${t} 제거`}
              >
                <MsCancelIcon size={10} />
              </button>
            )}
          </span>
        ))}
        <input
          ref={ref}
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-xs placeholder:text-fg-subtlest"
        />
      </div>
      {focused && availableSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-fg-subtlest">추천</span>
          {availableSuggestions.map(s => (
            <button
              key={s}
              type="button"
              onMouseDown={e => { e.preventDefault(); add(s); }}
              className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', tagColor(s), 'opacity-80 hover:opacity-100')}
            >
              <MsPlusIcon size={10} />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
