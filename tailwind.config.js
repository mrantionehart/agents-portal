/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
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
      },
    },
  },
  plugins: [],
}
