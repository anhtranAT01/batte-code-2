/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0a0e17',
          800: '#121826',
          700: '#182234',
          600: '#223049',
        },
        cyber: {
          cyan: '#00e5ff',
          purple: '#8b5cf6',
          green: '#10b981',
          gold: '#f59e0b',
          red: '#ef4444',
        }
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
