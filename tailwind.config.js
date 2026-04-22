import colors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#FFF0F5',
          100: '#FFD6E8',
          200: '#FFB3D3',
          300: '#FF8FBD',
          400: '#FF6CA6',
          500: '#FF4D89',
          600: '#E63577',
          700: '#CC2465',
          800: '#A01850',
          900: '#7A113D',
          950: '#4A0924',
        },
        success: colors.emerald,
        warning: colors.amber,
        danger:  colors.rose,
        neutral: colors.zinc,
      },
      fontFamily: {
        sans: ['Pretendard', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Noto Sans KR', 'sans-serif'],
      },
      boxShadow: {
        'card':       '0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08)',
        'raised':     '0 10px 15px -3px rgb(0 0 0 / 0.07), 0 4px 6px -4px rgb(0 0 0 / 0.07)',
        'modal':      '0 20px 25px -5px rgb(0 0 0 / 0.10), 0 8px 10px -6px rgb(0 0 0 / 0.10)',
      },
    },
  },
  plugins: [],
}
