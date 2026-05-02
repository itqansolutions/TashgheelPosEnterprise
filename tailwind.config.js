/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./js/**/*.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        'brand-purple-light': '#818cf8', /* Indigo 400 */
        'brand-purple':       '#6366f1', /* Indigo 500 */
        'brand-purple-dark':  '#4f46e5', /* Indigo 600 */
        'brand-blue':         '#3b82f6', /* Blue 500 */
        'brand-blue-dark':    '#2563eb', /* Blue 600 */
        'brand-green':        '#10b981', /* Emerald 500 */
        'brand-green-dark':   '#059669', /* Emerald 600 */
        'brand-red':          '#ef4444', /* Red 500 */
        'brand-red-dark':     '#dc2626', /* Red 600 */
        'brand-dark':         '#0f172a', /* Slate 900 */
        'brand-dark-2':       '#1e293b', /* Slate 800 */
        'brand-orange':       '#f59e0b', /* Amber 500 */
        'brand-gray-light':   '#f8fafc', /* Slate 50 */
      },
      boxShadow: {
        'premium': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 0 3px rgba(0,0,0,0.02)',
        'premium-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    }
  },
  plugins: [],
}
