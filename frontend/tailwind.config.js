import animate from 'tailwindcss-animate';
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Figtree Variable"', 'system-ui', 'sans-serif'],
        display: ['"Sora Variable"', '"Figtree Variable"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace'],
      },
      colors: {
        fond: 'hsl(var(--fond))',
        surface: 'hsl(var(--surface))',
        'surface-2': 'hsl(var(--surface-2))',
        bordure: 'hsl(var(--bordure))',
        texte: 'hsl(var(--texte))',
        attenue: 'hsl(var(--attenue))',
        accent: { DEFAULT: 'hsl(var(--accent))', doux: 'hsl(var(--accent-doux))', texte: 'hsl(var(--accent-texte))' },
        magenta: 'hsl(var(--magenta))',
        cyan: 'hsl(var(--cyan))',
        succes: 'hsl(var(--succes))',
        alerte: 'hsl(var(--alerte))',
        danger: 'hsl(var(--danger))',
        info: 'hsl(var(--info))',
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
      boxShadow: {
        carte: '0 1px 2px hsl(var(--ombre) / 0.06), 0 4px 16px -4px hsl(var(--ombre) / 0.10)',
        flottant: '0 12px 40px -8px hsl(var(--ombre) / 0.30)',
      },
      keyframes: {
        apparition: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        pulsation: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.45 } },
        montee: { from: { opacity: 0, transform: 'translateY(14px)' }, to: { opacity: 1, transform: 'none' } },
        entree: { from: { opacity: 0, transform: 'translateY(24px) scale(.97)' }, to: { opacity: 1, transform: 'none' } },
        derive: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(6%,-8%) scale(1.08)' },
          '66%': { transform: 'translate(-5%,6%) scale(.95)' },
        },
        flottement: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        degrade: { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        halo: { '0%,100%': { opacity: 0.55, transform: 'scale(1)' }, '50%': { opacity: 1, transform: 'scale(1.06)' } },
      },
      animation: {
        apparition: 'apparition .35s ease-out both',
        pulsation: 'pulsation 1.4s ease-in-out infinite',
        montee: 'montee .6s cubic-bezier(.2,.7,.2,1) both',
        entree: 'entree .8s cubic-bezier(.2,.7,.2,1) both',
        derive: 'derive 18s ease-in-out infinite',
        flottement: 'flottement 6s ease-in-out infinite',
        degrade: 'degrade 14s ease-in-out infinite',
        halo: 'halo 3.2s ease-in-out infinite',
        'rotation-lente': 'spin 9s linear infinite',
      },
    },
  },
  plugins: [animate],
};
