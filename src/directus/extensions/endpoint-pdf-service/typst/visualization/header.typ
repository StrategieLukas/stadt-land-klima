#import "city_types.typ"

#let header(is_major_city: false) = block[
  #box(
    width: 100%,
    [
    #place(center+horizon, dy: 0.5em, image("../slk_resources/StadtLandKlima-Logo.svg", height: 1.4cm, width: 6cm, fit: "contain"))
    #place(
      horizon+right,
      // Logo and Text
      place(
        horizon+right,
        stack(
          dir: ttb,
          spacing: 1.3em,
          text("Kommunales Ranking 2026", size: 1em, weight: "bold"),
          if(is_major_city){
            city_types.major_city
          }else{
            city_types.minor_city
          }
        )

      )
    )]
  )
]
