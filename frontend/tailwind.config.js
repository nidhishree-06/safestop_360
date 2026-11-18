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
        display: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        card: '20px',
        glass: '24px',
        control: '14px',
      },
      boxShadow: {
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
