/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: '#0d0d1a',
        surface: '#161625',
        primary: '#7B2CBF',
        accent: '#4cc9f0',
        'soft-white': '#e0e0e0',
        'light-gray': '#a0a0a0',
        'lavender-glow': '#c3a1ff',
        'cyan-glow': '#77e5ff',
      },
      boxShadow: {
        'glow-purple': '0 0 15px 5px rgba(123, 44, 191, 0.4)',
        'glow-lavender': '0 0 15px 5px rgba(195, 161, 255, 0.3)',
      },
      animation: {
        pulse: 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
