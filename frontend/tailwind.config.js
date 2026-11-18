/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        mint: {
          DEFAULT: 'var(--color-mint)',
          soft: 'var(--color-mint-soft)',
          dark: 'var(--color-mint-dark)',
          deep: 'var(--color-mint-deep)',
        },
        warm: {
          white: 'var(--color-warm-white)',
          surface: 'var(--color-warm-surface)',
        },
        charcoal: {
          DEFAULT: 'var(--color-charcoal)',
          muted: 'var(--color-text-secondary)',
        },
        border: {
          soft: 'var(--color-border)',
        },
        accent: {
          pink: 'var(--color-pink)',
          violet: 'var(--color-violet)',
          blue: 'var(--color-blue)',
        },
        status: {
          warning: 'var(--color-warning)',
          error: 'var(--color-error)',
        },
      },
      fontFamily: {
        display: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        display: ['3.5rem', { lineHeight: '4rem', letterSpacing: '-0.03em', fontWeight: '800' }],
        h1: ['2.5rem', { lineHeight: '3rem', letterSpacing: '-0.025em', fontWeight: '800' }],
        h2: ['1.875rem', { lineHeight: '2.35rem', letterSpacing: '-0.02em', fontWeight: '700' }],
        h3: ['1.375rem', { lineHeight: '1.85rem', letterSpacing: '-0.015em', fontWeight: '700' }],
        body: ['1rem', { lineHeight: '1.6rem', fontWeight: '400' }],
        caption: ['0.8125rem', { lineHeight: '1.15rem', fontWeight: '500' }],
      },
      borderRadius: {
        control: '12px',
        card: '20px',
        glass: '28px',
        pill: '9999px',
      },
      boxShadow: {
        'elev-1': '0 2px 8px rgba(34, 37, 42, 0.04), 0 1px 2px rgba(34, 37, 42, 0.03)',
        'elev-2': '0 6px 20px rgba(34, 37, 42, 0.06), 0 2px 5px rgba(34, 37, 42, 0.03)',
        'elev-3': '0 14px 34px rgba(34, 37, 42, 0.09), 0 3px 10px rgba(34, 37, 42, 0.04)',
        'elev-4': '0 24px 52px rgba(34, 37, 42, 0.13), 0 6px 16px rgba(34, 37, 42, 0.06)',
        matte: '0 4px 20px rgba(34, 37, 42, 0.045), 0 1px 3px rgba(34, 37, 42, 0.03)',
        'matte-hover': '0 10px 28px rgba(34, 37, 42, 0.07), 0 2px 6px rgba(34, 37, 42, 0.04)',
        glass: '0 12px 36px rgba(34, 37, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.72)',
        'glass-3d': '0 20px 44px rgba(34, 37, 42, 0.11), inset 0 1px 1px rgba(255, 255, 255, 0.85)',
        'neu-mint': '0 6px 16px rgba(104, 191, 163, 0.34), inset 0 1px 1px rgba(255, 255, 255, 0.75)',
        'neu-soft': '4px 4px 12px rgba(34, 37, 42, 0.06), -4px -4px 12px rgba(255, 255, 255, 0.9)',
      },
    },
  },
  plugins: [],
};
