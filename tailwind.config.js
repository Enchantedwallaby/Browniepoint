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
          50: '#fdf8f6',
          100: '#f2e8e5',
          200: '#e4d1cb',
          300: '#d0b0a6',
          400: '#b88979',
          500: '#9e6755',
          600: '#845041',
          700: '#6d4034',
          800: '#5c372e',
          900: '#4e3029',
          950: '#2b1713',
        },
      },
    },
  },
  plugins: [],
}
