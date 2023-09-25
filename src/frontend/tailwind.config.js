/** @type {import("tailwindcss").Config} */
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
      screens: {
        "xs": "420px",
      },
      fontFamily: {
        "sans": ["Inter", "sans"],
        "heading": ["RobotoCondensed", "sans"],
      },
      colors: {
        "ranking-0-2": "#D9000D",
        "ranking-2-4": "#F27C00",
        "ranking-4-6": "#FFD400",
        "ranking-6-8": "#AFCA0B",
        "ranking-8-10": "#1DA64A",
        "rating-3": "#1EA64A",
        "rating-2": "#FFDD00",
        "rating-1": "#E30613",
        "light-green": "#AFCA0B",
        "green": "#339737",
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
            color: "#505050",
            fontFamily: ["Inter", "sans"],
            "font-size": "1rem",
            "line-height": "1.5",
            h1: {
              fontFamily: ["RobotoCondensed", "sans"],
              "font-size": "2rem",
              "line-height": "1.5",
              color: "#000000",
              "font-weight": "bold",
            },
            h2: {
              fontFamily: ["RobotoCondensed", "sans"],
              "font-size": "1.5rem",
              "line-height": "1.5",
              color: "#000000",
              "font-Weight": "bold",
            },
            h3: {
              fontFamily: ["RobotoCondensed", "sans"],
              "font-size": "1.5rem",
              "line-height": "1.5",
              "font-weight": "normal",
              color: "#16bae7",
            },
            h4: {
              fontFamily: ["RobotoCondensed", "sans"],
              "font-size": "1.5rem",
              "line-height": "1.5",
              "font-weight": "normal",
              color: "#1da64a",
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
          fontFamily: ["Inter", "sans"],
        },
      },
    ],
  },
};
