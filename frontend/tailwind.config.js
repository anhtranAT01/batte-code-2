/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: 'rgb(var(--navy-950) / <alpha-value>)',
          900: 'rgb(var(--navy-900) / <alpha-value>)',
          850: 'rgb(var(--navy-850) / <alpha-value>)',
          800: 'rgb(var(--navy-800) / <alpha-value>)',
          750: 'rgb(var(--navy-750) / <alpha-value>)',
          700: 'rgb(var(--navy-700) / <alpha-value>)',
        },
        dark: {
          950: 'rgb(var(--dark-950) / <alpha-value>)',
          900: 'rgb(var(--dark-900) / <alpha-value>)',
          800: 'rgb(var(--dark-800) / <alpha-value>)',
          700: 'rgb(var(--dark-700) / <alpha-value>)',
          600: 'rgb(var(--dark-600) / <alpha-value>)',
        },
        cyber: {
          blue: '#3b82f6',
          cyan: '#06b6d4',
          neonCyan: '#00e5ff',
          purple: '#8b5cf6',
          violet: '#7c3aed',
          green: '#10b981',
          emerald: '#059669',
          gold: '#f59e0b',
          amber: '#d97706',
          red: '#ef4444',
          rose: '#f43f5e',
        }
      },
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-blue': '0 0 25px rgba(59, 130, 246, 0.25)',
        'glow-cyan': '0 0 25px rgba(6, 182, 212, 0.25)',
        'glow-purple': '0 0 25px rgba(139, 92, 246, 0.25)',
        'glow-emerald': '0 0 25px rgba(16, 185, 129, 0.25)',
        'glow-red': '0 0 25px rgba(239, 68, 68, 0.25)',
        'inner-glow': 'inset 0 0 15px rgba(59, 130, 246, 0.15)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'float 5s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        }
      }
    },
  },
  plugins: [],
}
