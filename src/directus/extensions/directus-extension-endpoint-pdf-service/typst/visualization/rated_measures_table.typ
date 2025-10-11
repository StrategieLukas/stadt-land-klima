#import "utils.typ" as util

#let star_generator(num_of_stars) = {
  if(num_of_stars != none){
    let num = int(num_of_stars)
    align(bottom,
    for (i) in range(0, num) {
      text([*★*], size: 1.3em)
    }
    )
  }
}

#let table_row_height = 1.3em

#let table_pin(rating) = table.cell(
  fill: white,
  inset: 0pt,
)[#align(center+horizon, image(util.select_pin_from_range(rating), height: table_row_height+0.2em))]


#let draw_measures_table(rating_measures) = {
  let color_gray = rgb("#EDEDED")
  show table.cell.where(y: 1): strong
  set table(
    fill: (x, y) =>
      if y == 1{ color_gray },

  )

  let rating_table_data = ()

  for sector in rating_measures.keys(){
    let sector_measures = rating_measures.at(sector)
    for measure in sector_measures{
      measure.insert("sortable_rating", 0)
      if not measure.applicable{
        measure.rating = none
        measure.sortable_rating = 1     // 1 to reverse sorting order
      }else{
        measure.sortable_rating = -float(measure.rating) // *(-1) to reverse sorting order
      }
      rating_table_data.push(measure)
    }
  }
  rating_table_data = rating_table_data.flatten().sorted(key: it => (it.sortable_rating, lower(it.measure.measure_id)))

  table(
    columns: (0.6cm, 1.1cm, 100%-6.7cm, 1.8cm, 1.8cm, 1.8cm),
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
              text(size: 6pt, fill: gray, "ansatzweise erfüllt"),
            )
          ]

        ),
        box(
          align(center + horizon)[
            #stack(
              dir: ttb,
              spacing: 3pt,
              image("../slk_resources/icon_rating_2.svg", height: 100%-3pt),
              text(size: 6pt, fill: gray, "halbwegs erfüllt"),
            )
          ]

          ),
        box(
          align(center + horizon)[
            #stack(
              dir: ttb,
              spacing: 3pt,
              image("../slk_resources/icon_rating_3.svg", height: 100%-3pt),
              text(size: 6pt, fill: gray, "größtenteils erfüllt"),
            )
          ]
        ),
        box(
          align(center + horizon)[
            #stack(
              dir: ttb,
              spacing: 3pt,
              image("../slk_resources/icon_rating_4.svg", height: 100%-3pt),
              text(size: 6pt, fill: gray, "vollständig erfüllt"),
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
    [], [ID], [Maßnahme], [Impact], [Kontroverse], [Preis],

    ..for (rating, measure, applicable) in rating_table_data{
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
  )
}

