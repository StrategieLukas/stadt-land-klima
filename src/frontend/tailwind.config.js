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
        "ff-green": "#1da64a",
        red: "#e30613",
        orange: "#f39200 ",
        "localzero-yellow": "#ffc80c",
        "light-blue": "#16bae7",
        black: "#000000",
        gray: "#DDDDDD",
      },
      boxShadow: {
        list: "0 3pt 6pt #00000029",
      },
      height: {
        "5/10": "50%",
      },
      width: {
        "5/10": "50%",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        staedteChallemgeTheme: {
          primary: "#afca0b",
          fontFamily: "Inter-Regular",
          h1: {
            fontFamily: "RobotoCondensed-Bold",
            "font-size": "32pt",
            "line-height": "32pt",
            color: "#000000",
          },
          h2: {
            fontFamily: "RobotoCondensed-Bold",
            "font-size": "24pt",
            "line-height": "24pt",
            color: "#000000",
          },
          h3: {
            fontFamily: "RobotoCondensed-Bold",
            "font-size": "24pt",
            "line-height": "24pt",
            color: "#16bae7",
          },
          h4: {
            fontFamily: "RobotoCondensed-Bold",
            "font-size": "24pt",
            "line-height": "24pt",
            color: "#afca0b",
          },
          a: {
            fontFamily: "Inter-Regular",
            "font-size": "14pt",
            "line-height": "17pt",
          },
          "a:hover": {
            "text-decoration": "underline dotted",
          },
          "a:focus": {
            "text-decoration": "underline dotted",
          },
          p: {
            fontFamily: "Inter-Regular",
            "font-size": "14pt",
            "line-height": "17pt",
            color: "#707070",
          },
          "p.note": {
            "font-size": "9",
            "line-height": "11",
          },
        },
      },
    ],
  },
};
