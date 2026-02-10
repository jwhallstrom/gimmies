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
      },
      // Cross-platform Safe Area & Dynamic Viewport utilities for PWA
      // env() returns 0 on Android (no safe areas), so fallbacks handle both platforms
      padding: {
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-top': 'env(safe-area-inset-top, 0px)',
      },
      height: {
        // Dynamic viewport height with fallback for older Android
        'screen-d': '100dvh',
        'screen-v': 'var(--app-height, 100vh)',
        // Nav base height (68px) + safe area inset
        'safe-nav': 'calc(68px + env(safe-area-inset-bottom, 0px))',
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-top': 'env(safe-area-inset-top, 0px)',
      },
      minHeight: {
        'screen-d': '100dvh',
        'screen-v': 'var(--app-height, 100vh)',
        'safe-nav': 'calc(68px + env(safe-area-inset-bottom, 0px))',
      },
      maxHeight: {
        'screen-d': '100dvh',
        'screen-v': 'var(--app-height, 100vh)',
      }
    }
  },
  plugins: []
};
