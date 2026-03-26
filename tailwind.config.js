/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        happi: {
          orange: '#FF8650',
          'orange-light': '#FFF1EB',
          'orange-dark': '#E86A35',
          teal: '#102C32',
          'teal-light': '#1A3F48',
          'teal-mid': '#1E4D57',
          'teal-muted': '#8AABB0',
        },
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '32px',
      },
      boxShadow: {
        'orange': '0 4px 20px rgba(255, 134, 80, 0.30)',
        'orange-lg': '0 8px 30px rgba(255, 134, 80, 0.40)',
        'teal': '0 4px 20px rgba(16, 44, 50, 0.15)',
        'card': '0 1px 4px rgba(16, 44, 50, 0.06), 0 4px 16px rgba(16, 44, 50, 0.06)',
      },
    },
  },
  plugins: [],
}
