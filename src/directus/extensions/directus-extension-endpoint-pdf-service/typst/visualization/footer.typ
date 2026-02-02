

#let footer(footer_text: "Kommunales Klimaranking powered by") = block[

  #box(
    width: 100%,
    [
    #place(
      horizon+center,
      // Logo and Text

      stack(
        dir: ltr,
        spacing: 0.5em,
        text(footer_text, size: 0.8em),
        image("../slk_resources/StadtLandKlima-Logo.svg",  height: 2em, alt: "Logo Stadt-Land-Klima", fit:"contain")
      )
    )]
  )
]
