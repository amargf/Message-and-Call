/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        messenger: {
          blue: '#0084ff',
          'blue-dark': '#006aff',
          'blue-light': '#e7f3ff',
        },
        chat: {
          light: '#f0f2f5',
          dark: '#2d2d2d',
        },
        bubble: {
          'in-light': '#ffffff',
          'out-light': '#0084ff',
          'in-dark': '#3b3b3b',
          'out-dark': '#0084ff',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'scale-in': 'scaleIn 0.15s ease-out',
      },
    },
  },
  plugins: [],
};
