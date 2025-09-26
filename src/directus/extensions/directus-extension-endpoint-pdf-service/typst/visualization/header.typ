

#let header = block[
  #box(
    width: 100%,
    [
    #place(
      horizon+right,
      // Logo and Text

      stack(
        dir: ttb,
        spacing: 0.5em,
        text("Kommunales Ranking 2025", size: 1em, weight: "bold"),
        image("../slk_resources/StadtLandKlima-Logo.svg",  height: 2em, alt: "Logo Stadt-Land-Klima", fit:"contain")
      )
    )]
  )
]