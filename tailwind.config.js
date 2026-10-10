/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101512',
        acid: '#d8ff48',
        coral: '#ff6f64',
        mint: '#68e5b2',
      },
    },
  },
  plugins: [],
}