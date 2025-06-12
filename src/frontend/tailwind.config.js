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
        xs: "420px",
      },
      fontFamily: {
        sans: "Inter",
        heading: "RobotoCondensed",
      },
      colors: {
        "ranking-0-2": "#D9000D",
        "ranking-2-4": "#F27C00",
        "ranking-4-6": "#FFD400",
        "ranking-6-8": "#AFCA0B",
        "ranking-8-10": "#1DA64A",
        "rating-3": "#1EA64A",
        "rating-2": "#AFCA0B",
        "rating-1": "#F39200",
        "rating-0": "#E30613",
        "light-green": "#AFCA0B",
        green: "#339737",
        "ff-green": "#1da64a",
        "olive-green" : "#3F8342",
        red: "#e30613",
        orange: "#f39200 ",
        "localzero-yellow": "#ffc80c",
        "light-blue": "#16bae7",
        gray: "#505050",
        "mid-gray": "#707070",
        black: "#000000",
      },
      boxShadow: {
        list: "0 3pt 6pt #00000029",
      },
      height: {
        "58/100": "58%",
        "60/100": "60%",
      },
      width: {
        18: "4.5rem",
        "58/100": "58%",
        "60/100": "60%",
      },
      fontSize: {
        h1: "clamp(1.5rem, 4.69vw, 2rem)",
        h2: "clamp(1.15rem, 3.32vw, 1.5rem)",
        h3: "clamp(1.15rem, 2.93vw, 1.5rem)",
        h4: "clamp(1rem, 2.05vw, 1.5rem)",
      },
      typography: {
        DEFAULT: {
          css: {
            color: "#505050",
            fontFamily: "Inter",
            "font-size": "1rem",
            "line-height": "1.5",
            h1: {
              fontFamily: "RobotoCondensed",
              "font-size": "clamp(1.5rem, 4.69vw, 2rem)",
              "line-height": "1.5",
              color: "#000000",
              "font-weight": "bold",
            },
            h2: {
              fontFamily: "RobotoCondensed",
              "font-size": "clamp(1.15rem, 3.32vw, 1.5rem)",
              "line-height": "1.5",
              color: "#000000",
              "font-Weight": "bold",
            },
            h3: {
              fontFamily: "RobotoCondensed",
              "font-size": "clamp(1.15rem, 2.93vw, 1.5rem)",
              "line-height": "1.5",
              "font-weight": "normal",
              color: "#16bae7",
            },
            h4: {
              fontFamily: "RobotoCondensed",
              "font-size": "clamp(1rem, 2.05vw, 1.5rem)",
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
  safelist: [
    'bg-rating-0',
    'bg-rating-1',
    'bg-rating-2',
    'bg-rating-3',
    'bg-opacity-10',
    'bg-opacity-20',
    'bg-opacity-30',
    ],
  plugins: [require("daisyui"), require("@tailwindcss/typography")],
  daisyui: {
    themes: [
      {
        staedteChallemgeTheme: {
          primary: "#afca0b",
          secondary: "#f27c00",
          accent: "#00aee2",
          neutral: "#707070",
          "base-100": "#ffffff",
          fontFamily: ["Inter", "sans"],
        },
      },
    ],
  },
};
