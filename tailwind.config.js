/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    // RELEASE.002B: the Contact Support modal lives under src/ and uses
    // classes (z-[100], sm:max-w-lg, max-h-[92vh], the modal shadow/backdrop)
    // not present in app/ or components/, so Tailwind must scan it directly.
    // Scoped to this feature dir to avoid changing generation for other src/ files.
    './src/portal/support/**/*.{js,ts,jsx,tsx,mdx}',
    // PAPERWORK UX-001 — workflow-first Form Library uses unique classes
    // (workflow-card grids, star toggles) that must be scanned for CSS.
    './src/portal/library/**/*.{js,ts,jsx,tsx,mdx}',
    // TODAY I.001 — the Home "Today" surface (TodayRow/TodaySection, later slices)
    // lives under src/portal/home and uses unique classes not present in app/;
    // Tailwind must scan it directly or those classes emit no CSS (invisible UI).
    './src/portal/home/**/*.{js,ts,jsx,tsx,mdx}',
    // CommissionPayoutsCard lives under src/portal/settings and uses unique
    // classes (e.g. text-emerald-400) not otherwise emitted; scan it directly.
    './src/portal/settings/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        heading: ['var(--font-playfair)', 'Georgia', 'Times New Roman', 'serif'],
      },
      colors: {
        primary: '#2563eb',
        secondary: '#1e40af',
        accent: '#C9A84C',
        'hartfelt-gold': '#C9A84C',
        danger: '#dc2626',
        success: '#16a34a',
        warning: '#eab308',
        'hf-black': '#050505',
        'hf-graphite': { 900: '#121212', 800: '#18181B', 700: '#232326', 600: '#2A2A2E' },
        'hf-gold': { DEFAULT: '#B89B5E', deep: '#9D824B', soft: '#D8C49A' },
        'hf-navy': { DEFAULT: '#162033', soft: '#22314D' },
        'hf-warm-white': '#F8F8F6',
        'hf-cool-gray': { 100: '#F1F1F3', 200: '#E5E5E7', 300: '#C7C7CC', 400: '#A1A1AA' },
        'brand-gold': '#C9A84C',
        'brand-gold-light': '#E8D5A3',
        'surface-dark': '#0a0a0f',
        'surface-darker': '#050507',
        'border-dark': '#1a1a2e',
      },
    },
  },
  plugins: [],
}
