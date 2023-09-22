/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./components/**/*.{js,vue,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./plugins/**/*.{js,ts}",
    "./nuxt.config.{js,ts}",
    "./app.vue",
  ],
  theme: {
    extend: {
      colors: {
        "light-green": "#AFCA0B",
        "ff-green": "#1da64a",
        red: "#e30613",
        orange: "#f39200 ",
        "localzero-yellow": "#ffc80c",
        "light-blue": "#16bae7",
        black: "#000000",
      },
      boxShadow: {
        list: "0 3pt 6pt #00000029",
      },
      height: {
        "55/100": "55%",
        "60/100": "60%",
      },
      width: {
        "55/10": "55%",
        "60/100": "60%",
      },
      typography: {
        DEFAULT: {
          css: {
            color: "#707070",
            fontFamily: "Inter-Regular",
            "font-size": "1rem",
            "line-height": "1.5",
            h1: {
              fontFamily: "RobotoCondensed-Bold",
              "font-size": "2rem",
              "line-height": "1.5",
              color: '#000000',
            },
            h2: {
              fontFamily: "RobotoCondensed-Bold",
              "font-size": "1.5rem",
              "line-height": "1.5",
              color: '#000000',
            },
            h3: {
              fontFamily: "RobotoCondensed-Regular",
              "font-size": "1.5rem",
              "line-height": "1.5",
              "font-weight": 400,
              color: '#16bae7',
            },
            h4: {
              fontFamily: "RobotoCondensed-Regular",
              "font-size": "1.5rem",
              "line-height": "1.5",
              "font-weight": 400,
              color: '#1da64a',
            },
            "a:hover": {
              "text-decoration": "underline dotted",
            },
            "a:focus": {
              "text-decoration": "underline dotted",
            },
            "p.note": {
              "font-size": "0.75rem",
            },
          },
        },
      },
    },
  },
  plugins: [require("daisyui"), require("@tailwindcss/typography")],
  daisyui: {
    themes: [
      {
        staedteChallemgeTheme: {
          primary: "#afca0b",
          secondary: "#f27c00",
          accent: "#00aee2",
          neutral: "#707070",
          "base-100": "#000000",
          fontFamily: "Inter-Regular",
        },
      },
    ],
  },
};
