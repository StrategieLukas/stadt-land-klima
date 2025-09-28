#import "utils.typ" as colors

#let measure_block(measure) = [
  #rect(
    fill: colors.select_color_from_range(measure.rating, factor: 100),
    height: 100%,
    width: 0.35em,
    stroke: colors.select_color_from_range(measure.rating, factor: 100)
  )
]

#let draw_rating_bars(rated_measures, height) = [
  #let sorted_measures = rated_measures.filter(it => it.applicable).sorted(key: it => it.rating)
  #let unapplicable_measures = rated_measures.filter(it => not it.applicable)
  #let height = 2*height

  #let total_num_of_measures = rated_measures.len() + unapplicable_measures.len()
  #box(
    width: 100%,
    height: height,
    [
      #align(left + horizon)[
        #box(
          width: 50%,
          height: height,
          stack(
            dir: ltr,
            spacing: 2.5pt,
            ..sorted_measures.map(measure => measure_block(measure)),
            ..unapplicable_measures.map(measure => measure_block(measure))
          )
          
        )
      ]
      #place(right+horizon)[
        *#rated_measures.len() von #total_num_of_measures*
      ]
    ]
  )
]