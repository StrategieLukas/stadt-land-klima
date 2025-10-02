#import "utils.typ"

#let radius = 2pt
#let img_height = 1cm
#let img_width = 4.5cm

#let city(image_path, main_text, subtext) = {
  box(
    height: img_height,
    [
      #stack(
        dir: ltr,
        rect(
          radius: (left: radius),
          fill: utils.slk_light_green,
          height: 0.6cm,
          stroke: (right: (paint: white, thickness: 1.5pt)),
          inset: 1.5pt,
          [
            #image(image_path)
          ]
        ),
        rect(
          radius: (right: radius),
          fill: utils.slk_light_green,
          height: 0.6cm,
          width: img_width - img_height,
          [
            #align(left+horizon)[
              #text(main_text, fill: white, size: 9pt, weight: "bold")
            ]
          ]
        )
      )
      #v(-13pt)
      #align(left)[
      #text(subtext, fill: gray, size: 7pt)]
    ]
  )
}

#let minor_city = [
  #city("../slk_resources/minor-city-light.svg", "Städte und Gemeinden", "mit weniger als 100.000 Einwohner:innen")
]

#let major_city = [
  #city("../slk_resources/major-city-light.svg", "Großstädte", "mit mehr als 100.000 Einwohner:innen")
]