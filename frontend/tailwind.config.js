/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#0000FF',
          'blue-light': '#4040FF',
          yellow: '#FEC500',
          dark: '#191919',
          'dark-light': '#242424',
          'dark-lighter': '#2E2E2E',
          green: '#00FF80',
        },
        surface: {
          DEFAULT: '#191919',
          card: '#242424',
          hover: '#2E2E2E',
          border: '#3A3A3A',
        },
      },
    },
  },
  plugins: [],
}
