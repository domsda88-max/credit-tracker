/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /**
       * Дизайн-токены. Единственный источник цветов в приложении.
       * Значения живут в styles/tokens.css как OKLCH-компоненты,
       * здесь — только семантические имена.
       */
      colors: {
        primary: 'rgb(var(--c-primary) / <alpha-value>)',
        'primary-fg': 'var(--color-primary-fg)',
        'primary-soft': 'rgb(var(--c-primary-soft) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
        'success-fg': 'var(--color-success-fg)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
        'warning-fg': 'var(--color-warning-fg)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        'danger-fg': 'var(--color-danger-fg)',
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        surface2: 'rgb(var(--c-surface2) / <alpha-value>)',
        t1: 'rgb(var(--c-t1) / <alpha-value>)',
        t2: 'rgb(var(--c-t2) / <alpha-value>)',
        t3: 'rgb(var(--c-t3) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          'Roboto',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        // Шкала из дизайн-системы: 32 / 24 / 20 / 16 / 15 / 13 / 12
        hero: ['32px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
        title: ['24px', { lineHeight: '30px', letterSpacing: '-0.01em' }],
        heading: ['20px', { lineHeight: '26px' }],
        body: ['16px', { lineHeight: '1.55' }],
        base: ['15px', { lineHeight: '22px' }],
        caption: ['13px', { lineHeight: '1.45' }],
        micro: ['12px', { lineHeight: '16px' }],
        money: ['20px', { lineHeight: '1.3' }],
      },
      borderRadius: {
        card: '16px',
        control: '12px',
        chip: '10px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        sheet: '0 -8px 32px rgb(0 0 0 / 0.24)',
      },
      transitionTimingFunction: {
        app: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 350ms cubic-bezier(0.4, 0, 0.2, 1) both',
        'fade-in': 'fade-in 300ms cubic-bezier(0.4, 0, 0.2, 1) both',
        'sheet-up': 'sheet-up 150ms cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};
