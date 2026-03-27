/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
  ],
  theme: {
    extend: {
      colors: {
        'brand-purple-light': '#667eea',
        'brand-purple':       '#764ba2',
        'brand-purple-dark':  '#5a387e',
        'brand-blue':         '#3498db',
        'brand-blue-dark':    '#2980b9',
        'brand-green':        '#27ae60',
        'brand-green-dark':   '#229954',
        'brand-red':          '#e74c3c',
        'brand-red-dark':     '#c0392b',
        'brand-dark':         '#2c3e50',
        'brand-dark-2':       '#34495e',
        'brand-orange':       '#f39c12',
      }
    }
  },
  plugins: [],
}
