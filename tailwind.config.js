/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Makestar DS Raw Palette ──────────────────────────────────
        // gray-001(lightest) → gray-099(darkest)
        gray: {
          '001': '#fcfdfd',
          '005': '#f0f3f4',
          '010': '#e1e6ea',
          '020': '#c4cdd4',
          '030': '#a7b3be',
          '040': '#8a99a8',
          '050': '#6d7f92',
          '060': '#4c5a66',
          '070': '#3b454f',
          '080': '#2d353d',
          '090': '#1f242a',
          '099': '#111417',
        },
        // brand1 — Primary pink
        pink: {
          '005': '#fce8ef',
          '010': '#fad1df',
          '020': '#f5a3be',
          '030': '#f76e9c',
          '040': '#ff4d89',
          '050': '#e5195e',
          '060': '#b7154b',
        },
        // brand2 — Secondary purple (violet은 purple 별칭: bg-violet-* = bg-purple-*)
        purple: {
          '005': '#efe8fd',
          '010': '#d9c6fb',
          '040': '#863dff',
          '050': '#6204fb',
          '060': '#5207cf',
        },
        violet: {
          '50':  '#efe8fd',  // violet-50  → purple-005
          '100': '#d9c6fb',  // violet-100 → purple-010
          '200': '#d9c6fb',  // violet-200 → purple-010
          '400': '#863dff',  // violet-400 → purple-040
          '500': '#863dff',  // violet-500 → purple-040
          '600': '#6204fb',  // violet-600 → purple-050
          '700': '#5207cf',  // violet-700 → purple-060
        },
        // indigo는 DS blue로 매핑: bg-indigo-* = DS blue 근사값
        indigo: {
          '50':  '#e8f6fd',  // indigo-50  → blue-005
          '100': '#c8e9f9',  // indigo-100 → blue-010
          '200': '#a3daf5',  // indigo-200 → blue-020
          '300': '#6cc3ef',  // indigo-300 → blue-020/040 중간
          '400': '#35ade9',  // indigo-400 → blue-040
          '500': '#19a1e6',  // indigo-500 → blue-050
          '600': '#1482b8',  // indigo-600 → blue-060
          '700': '#1482b8',  // indigo-700 → blue-060
          '800': '#0f628a',  // indigo-800 → blue-070
          '060': '#144bb8',  // DS indigo-060 (원래 값 유지)
        },
        blue: {
          '005': '#e8f6fd',
          '010': '#c8e9f9',
          '020': '#a3daf5',
          '040': '#35ade9',
          '050': '#19a1e6',
          '060': '#1482b8',
          '070': '#0f628a',
        },
        green: {
          '005': '#e3fce8',
          '010': '#b3f4c1',
          '020': '#87e89e',
          '030': '#5ed97e',
          '040': '#39c661',
          '050': '#2cac4e',
          '060': '#20903c',
          '070': '#16732c',
        },
        yellow: {
          '005': '#fdf9e8',
          '060': '#b89f14',
          '070': '#8a780f',
        },
        orange: {
          '005': '#fdeee8',
          '010': '#fad5c7',
          '020': '#f6b8a0',
          '040': '#ed7a4f',
          '050': '#e65019',
          '060': '#c04416',
          '070': '#913412',
        },
        red: {
          '005': '#fde8e8',
          '010': '#f7baba',
          '020': '#f28c8c',
          '040': '#e93939',
          '050': '#e61919',
          '060': '#b81414',
          '070': '#931010',
        },
        overlay: {
          '048': 'rgba(0,0,0,0.47)',
          '072': 'rgba(0,0,0,0.72)',
          '080': 'rgba(0,0,0,0.80)',
        },

        // ── Makestar DS Semantic Tokens (CSS var 참조) ───────────────
        // 사용 예: text-fg-default, bg-bg-subtle, border-border-default
        fg: {
          'default':          'var(--token-fg-default)',
          'subtle':           'var(--token-fg-subtle)',
          'subtlest':         'var(--token-fg-subtlest)',
          'disabled':         'var(--token-fg-disabled)',
          'danger':           'var(--token-fg-danger-default)',
          'danger-bolder':    'var(--token-fg-danger-bolder)',
          'warning':          'var(--token-fg-warning-default)',
          'success':          'var(--token-fg-success-default)',
          'info':             'var(--token-fg-info-default)',
          'inverse':          'var(--token-fg-inverse-default)',
          'inverse-subtle':   'var(--token-fg-inverse-subtle)',
          'brand1':           'var(--token-fg-accent-brand1-default)',
          'brand1-bolder':    'var(--token-fg-accent-brand1-bolder)',
          'brand1-subtle':    'var(--token-fg-accent-brand1-subtle)',
          'brand2':           'var(--token-fg-accent-brand2-default)',
          'brand2-bolder':    'var(--token-fg-accent-brand2-bolder)',
        },
        'bg-token': {
          'default':          'var(--token-bg-default)',
          'subtle':           'var(--token-bg-subtle)',
          'subtlest':         'var(--token-bg-subtlest)',
          'disabled':         'var(--token-bg-disabled)',
          'danger':           'var(--token-bg-danger)',
          'success':          'var(--token-bg-success)',
          'warning':          'var(--token-bg-warning)',
          'info':             'var(--token-bg-info)',
          'inverse':          'var(--token-bg-inverse-default)',
          'inverse-subtle':   'var(--token-bg-inverse-subtle)',
          'brand1':           'var(--token-bg-accent-brand1-default)',
          'brand1-hover':     'var(--token-bg-accent-brand1-hovered)',
          'brand1-press':     'var(--token-bg-accent-brand1-pressed)',
          'brand1-subtle':    'var(--token-bg-accent-brand1-subtle)',
          'brand1-subtlest':  'var(--token-bg-accent-brand1-subtlest)',
          'brand2':           'var(--token-bg-accent-brand2-default)',
          'brand2-hover':     'var(--token-bg-accent-brand2-hovered)',
          'brand2-subtle':    'var(--token-bg-accent-brand2-subtle)',
        },
        'bd': {
          'default':          'var(--token-border-default)',
          // Phase D-1.2: Figma Color/Border/Primary (#dee2e6) 정합 — bd.default 와 bd.subtle 사이 단계
          'primary':          'var(--token-border-primary)',
          'subtle':           'var(--token-border-subtle)',
          'subtlest':         'var(--token-border-subtlest)',
          'disabled':         'var(--token-border-disabled)',
          'focused':          'var(--token-border-focused)',
          'overlay':          'var(--token-border-overlay)',
          'danger':           'var(--token-border-danger)',
          'success':          'var(--token-border-success)',
          'warning':          'var(--token-border-warning)',
          'info':             'var(--token-border-info)',
          'brand1':           'var(--token-border-accent-brand1-default)',
          'brand1-subtle':    'var(--token-border-accent-brand1-subtle)',
          'brand2':           'var(--token-border-accent-brand2-default)',
        },
      },
      fontFamily: {
        sans: ['"Pretendard Variable"', 'Pretendard', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // Phase D-1.4: shadow → 면 (Figma 정합)
        // 카드 류는 border 만으로 영역 분리. 모든 shadow-card / shadow-card-hover
        // 사용처가 자동으로 none 처리됨 (36+ 파일). 기존 클래스 명명은 유지 —
        // 이후 점진 마이그레이션 시 직접 제거 예정.
        // overlay 류 (raised, modal, overlay) 는 유지 — modal/drawer/popover 는
        // 평면 위의 띄움 단계가 의미상 필요.
        'card':       'none',
        'card-hover': 'none',
        'raised':     '0 10px 15px -3px rgba(17,20,23,0.07), 0 4px 6px -4px rgba(17,20,23,0.07)',
        'modal':      '0 20px 25px -5px rgba(17,20,23,0.10), 0 8px 10px -6px rgba(17,20,23,0.10)',
        'overlay':    '0 1px 3px rgba(17,20,23,0.18)',
      },
    },
  },
  plugins: [],
}
