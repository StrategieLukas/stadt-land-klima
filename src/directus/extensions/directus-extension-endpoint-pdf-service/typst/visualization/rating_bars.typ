#import "utils.typ" as colors

#let measure_block(measure) = [
  #rect(
    fill: colors.select_color_from_range(float(measure.rating)*100),
    height: 100%,
    width: 0.35em,
    stroke: colors.select_color_from_range(float(measure.rating)*100)
  )
]

#let draw_rating_bars(measures, height) = [
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
            dir: rtl,
            spacing: 2.5pt,
            ..measures.map(measure => measure_block(measure))
          )
          
        )
      ]
      #place(right+horizon)[
        *#measures.len() von #measures.len()*
      ]
    ]
  )
]