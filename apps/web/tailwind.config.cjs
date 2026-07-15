/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        'body-sm': ['0.875rem', { lineHeight: '1.25rem' }],   // 14px
        'body-base': ['1rem', { lineHeight: '1.5rem' }],       // 16px
        'h3': ['1.125rem', { lineHeight: '1.5rem' }],          // 18px
        'h2': ['1.25rem', { lineHeight: '1.75rem' }],          // 20px
        'h1': ['1.5rem', { lineHeight: '2rem' }],              // 24px
        'h1-lg': ['1.75rem', { lineHeight: '2.25rem' }],       // 28px
        'metrics-lg': ['1.75rem', { lineHeight: '2.25rem' }],  // 28px
        'metrics-xl': ['2rem', { lineHeight: '2.5rem' }],      // 32px
        'badge': ['0.8125rem', { lineHeight: '1.125rem' }],    // 13px
      },
      spacing: {
        '4.5': '1.125rem',  // 18px
        '13': '3.25rem',    // 52px
        '15': '3.75rem',    // 60px
      },
      minHeight: {
        'btn': '2.75rem',     // 44px
        'input': '2.75rem',   // 44px
        'row': '3rem',        // 48px
        'card': '3.5rem',     // 56px
      },
      borderRadius: {
        'card': '0.75rem',  // 12px
        'modal': '1rem',     // 16px
      },
      colors: {
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },

        // ─── Learning Engine · Design System (DS-0) ──────────────────────
        // Var-backed (canales RGB + <alpha-value>) → soporta modificadores de
        // opacidad y deja el dark mode futuro a un simple re-mapeo de las vars.
        // Ver docs/DESIGN_SYSTEM_LEARNING.md §2. Cero hex sueltos en la UI.
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: {
          1: 'rgb(var(--surface-1) / <alpha-value>)',
          2: 'rgb(var(--surface-2) / <alpha-value>)',
          3: 'rgb(var(--surface-3) / <alpha-value>)',
        },
        ink: {
          primary: 'rgb(var(--ink-primary) / <alpha-value>)',
          secondary: 'rgb(var(--ink-secondary) / <alpha-value>)',
          muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        },
        hairline: 'rgb(var(--hairline) / <alpha-value>)',
        // El acento resuelto por habilidad (data-skill). Un solo lugar.
        accent: 'rgb(var(--skill-accent) / <alpha-value>)',
        // Codifican habilidad (10–15% de fondo, 100% solo en lo activo).
        skill: {
          reading: '#2E6BE6',
          listening: '#0E9F8E',
          speaking: '#7C5CFF',
          writing: '#E08A1E',
        },
        // SOLO en feedback. Nunca como decoración.
        feedback: {
          correct: '#1FA971',
          error: '#E5484D',
          warn: '#E0A020',
        },
      },
      maxWidth: {
        'workspace': '87.5rem', // 1400px
      },
    },
  },
  plugins: [],
}
