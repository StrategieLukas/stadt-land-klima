#import "utils.typ" as util

#let star_generator(num_of_stars) = {
  if(num_of_stars != none){
    let num = int(num_of_stars)
    align(bottom, 
    for (i) in range(0, num) {
      text([*★*], size: 1.4em)
    }
    )
  }
}

#let table_row_height = 1.3em
#let table_pin(rating) = table.cell(
  fill: white,
)[#align(center+horizon, image(util.select_pin_from_range(rating), height: table_row_height+0.2em))]


#let draw_measures_table(rating_measures) = {
  let color_gray = rgb("#EDEDED")
  show table.cell.where(y: 1): strong
  set table(
    fill: (x, y) =>
      if y == 1{ color_gray },

  )

  table(
    columns: (8fr, 16fr, 122fr, 21fr, 21fr, 21fr),
    stroke: white + 0.2em,
    rows: (2.5em, table_row_height),
    table.cell(colspan: 3)[
      #stack(
        dir: ltr,
        spacing: 2em,
        "Bewertungsampel\nMaßnahmen",
        box(
          align(center + top)[
            #stack(
              dir: ttb,
              image("../slk_resources/icon_rating_0.svg", height: 100%-3pt),  
              text(size: 6pt, fill: gray, "nicht erfüllt"), 
            )
          ]),
        box(
          align(center + horizon)[
            #stack(
              dir: ttb,
              spacing: 3pt,
              image("../slk_resources/icon_rating_1.svg", height: 100%-3pt), 
              text(size: 6pt, fill: gray, "1/3 erfüllt"), 
            )
          ]
          
        ),
        box(
          align(center + horizon)[
            #stack(
              dir: ttb,
              spacing: 3pt,
              image("../slk_resources/icon_rating_2.svg", height: 100%-3pt), 
              text(size: 6pt, fill: gray, "2/3 erfüllt"), 
            )
          ]
          
          ),
        box(
          align(center + horizon)[
            #stack(
              dir: ttb,
              spacing: 3pt, 
              image("../slk_resources/icon_rating_3.svg", height: 100%-3pt), 
              text(size: 6pt, fill: gray, "erfüllt"), 
            )
          ]
        ),
        box(
          align(center + horizon)[
            #stack(
              dir: ttb,
              spacing: 3pt, 
              image("../slk_resources/icon_rating_na.svg", height: 100%-3pt), 
              text(size: 6pt, fill: gray, "nicht anwendbar"), 
            )
          ]
        )
      )
    ], 
    [#align(center + horizon, [#image("../slk_resources/icon_impact.svg")])], 
    [#align(center + horizon, [#image("../slk_resources/icon_politics.svg")])], 
    [#align(center + horizon, [#image("../slk_resources/icon_invest.svg")])],
    [], [Nummer], [Maßnahme], [Impact], [Politisch], [Invest],
    
    ..for (sector, ratings) in rating_measures{
      for (rating, measure) in ratings {
        let table_row_color = util.select_color_from_range(rating, factor : 100).transparentize(80%)
        
        (
          table_pin(rating),
          (
            measure.measure_id, 
            measure.name, 
            star_generator(measure.impact), 
            star_generator(measure.feasibility_political), 
            star_generator(measure.feasibility_economical)
          ).map(cell => (table.cell(fill: table_row_color)[#cell]))
        ).flatten()
    }
    }
  )
}

