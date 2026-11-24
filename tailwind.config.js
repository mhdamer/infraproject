/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}', './public/js/**/*.js'],
  theme: {
    extend: {
      fontFamily: { sans: ['Cairo', 'sans-serif'] },
      colors: {
        i1: 'rgb(var(--c-i1) / <alpha-value>)',
        i2: 'rgb(var(--c-i2) / <alpha-value>)',
        i3: 'rgb(var(--c-i3) / <alpha-value>)',
        i4: 'rgb(var(--c-i4) / <alpha-value>)',
        i5: 'rgb(var(--c-i5) / <alpha-value>)',
        i6: 'rgb(var(--c-i6) / <alpha-value>)'
      }
    }
  },
  plugins: []
};
