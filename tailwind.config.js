import colors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#FFF2F7',
          100: '#FFD9E8',
          200: '#FFB3CF',
          300: '#FF8DB5',
          400: '#FF669C',
          500: '#FF558F',
          600: '#E63D7A',
          700: '#CC2B67',
          800: '#A01E51',
          900: '#7A163E',
          950: '#4A0C24',
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
