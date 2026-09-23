/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
        },
        lavender: {
          50: '#F3E8FF',
          100: '#E9D5FF',
          200: '#DDD6FE',
          300: '#C084FC',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
        },
        surface: {
          bg: '#F8FAFC',
          panel: '#F1F5F9',
          border: '#E2E8F0',
          text: '#0F172A',
          subtext: '#475569',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px 0 rgba(15, 23, 42, 0.03)',
        'floating': '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
      }
    },
  },
  plugins: [],
}
