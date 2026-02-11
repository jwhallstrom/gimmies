/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#E6F2FF',
          100: '#B3D9FF',
          200: '#80C0FF',
          300: '#4DA7FF',
          400: '#1A8EFF',
          500: '#0075E6',
          600: '#005CB3',
          700: '#004380',
          800: '#002A4D',
          900: '#00111A',
        },
      },
    },
  },
  plugins: [],
};
