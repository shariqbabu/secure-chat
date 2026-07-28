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
        primary: {
          DEFAULT: '#075E54',
          dark: '#054640',
          light: '#128C7E',
        },
        secondary: {
          DEFAULT: '#25D366',
          dark: '#1DA851',
          light: '#34E877',
        },
        chat: {
          bg: '#E5DDD5',
          sent: '#DCF8C6',
          received: '#FFFFFF',
          dark: {
            bg: '#0B141A',
            sent: '#005C4B',
            received: '#202C33',
          }
        },
        sidebar: {
          light: '#F0F2F5',
          dark: '#111B21',
        }
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-in',
        'typing': 'typing 1.4s infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        typing: {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}
