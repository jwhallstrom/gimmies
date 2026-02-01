/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        tournament: {
          primary: '#1e3a5f',
          secondary: '#2d5a87',
          accent: '#4a90c2',
        },
      },
    },
  },
  plugins: [],
}
