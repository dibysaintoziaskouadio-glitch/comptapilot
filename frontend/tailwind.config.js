import animate from 'tailwindcss-animate';
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
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
      },
      animation: { apparition: 'apparition .35s ease-out both', pulsation: 'pulsation 1.4s ease-in-out infinite' },
    },
  },
  plugins: [animate],
};
