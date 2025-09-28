#import "utils.typ" as colors

#let measure_block(measure) = [
  #rect(
    fill: colors.select_color_from_range(float(measure.rating)*100),
    height: 100%,
    width: 0.35em,
    stroke: colors.select_color_from_range(float(measure.rating)*100)
  )
]

#let draw_rating_bars(rated_measures, height) = [
  #let sorted_measures = rated_measures.sorted(key: it => it.rating)
  #let height = 2*height
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
            ..sorted_measures.map(measure => measure_block(measure))
          )
          
        )
      ]
      #place(right+horizon)[
        *#rated_measures.len() von #rated_measures.len()*
      ]
    ]
  )
]