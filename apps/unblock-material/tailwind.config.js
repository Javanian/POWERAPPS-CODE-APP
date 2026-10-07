/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          "deep-twilight": "#03045e",
          "french-blue": "#023e8a",
          "bright-teal-blue": "#0077b6",
          "blue-green": "#0096c7",
          "turquoise-surf": "#00b4d8",
          "sky-aqua": "#48cae4",
          "frosted-blue": "#90e0ef",
          "frosted-blue-2": "#ade8f4",
          "light-cyan": "#caf0f8",
        },
      },
    },
  },
  plugins: [],
};
