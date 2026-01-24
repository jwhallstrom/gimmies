/******** Tailwind Config ********/ 
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          // Gimmies orange accent
          DEFAULT: '#F28329'
        },
        primary: {
          // Gimmies primary blue system
          // Brand anchor: #1561AE
          DEFAULT: '#1561AE',
          50: '#EEF6FF',
          100: '#D9EBFF',
          200: '#B7D6FF',
          300: '#8BBEFF',
          400: '#5FA4F7',
          500: '#378AE7',
          600: '#1561AE',
          700: '#114C88',
          800: '#0D3762',
          900: '#09243F'
        }
      }
    }
  },
  plugins: []
};
