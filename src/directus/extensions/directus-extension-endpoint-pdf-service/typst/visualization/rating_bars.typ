#import "utils.typ" as colors

#let measure_block(measure) = [
  #let color = if(measure.applicable){ 
    colors.select_color_from_range(measure.rating, factor: 100)
  }else{
    colors.select_color_from_range(none)
  }
  #rect(
    fill: color,
    height: 100%,
    width: 0.35em,
    stroke: color
  )
]

#let draw_rating_bars(rated_measures, height) = [
  #let sorted_measures = rated_measures.filter(it => it.applicable).sorted(key: it => it.rating)
  #let unapplicable_measures = rated_measures.filter(it => not it.applicable)
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
            ..sorted_measures.map(measure => measure_block(measure)),
            ..unapplicable_measures.map(measure => measure_block(measure))
          )
          
        )
      ]
      #place(right+horizon)[
        *#sorted_measures.len() von #rated_measures.len()*
      ]
    ]
  )
]