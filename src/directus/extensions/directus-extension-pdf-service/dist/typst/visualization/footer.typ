

#let footer = block[
  #box(
    width: 100%,
    [
    #place(
      horizon+center,
      // Logo and Text

      stack(
        dir: ltr,
        spacing: 0.5em,
        text("Kommunales Klimaranking powered by", size: 0.8em),
        image("../slk_resources/StadtLandKlima-Logo.svg",  height: 2em, alt: "Logo Stadt-Land-Klima", fit:"contain")
      )
    )]
  )
]