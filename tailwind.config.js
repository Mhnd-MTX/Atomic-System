/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#080b11',
        acid: '#078ff1',
        coral: '#ff6f64',
        mint: '#20b7e8',
      },
    },
  },
  plugins: [],
}