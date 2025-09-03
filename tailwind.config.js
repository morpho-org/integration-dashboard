/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontSize: {
        '2xs': '12px',
        '3xs': '8px',
      }
    },
  },
  plugins: [],
};
