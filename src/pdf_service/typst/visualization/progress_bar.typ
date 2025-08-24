#import "colors.typ"

#let draw_progress_bar(progress, unit) = [
  #let color = colors.select_color_from_range(progress);
  #let height = 2*unit;
  #let radius = 0.2*unit;


  #box(
    width: 100%,
    align(center,
      [
        #place(
          top,
          rect(stroke: color, fill: color, height: height, width: progress * 1%, radius: radius)
        )
        #place(
          top,
          rect(stroke: color, fill: none, height: height, width: (100.0) * 1%, radius: radius)
        )
        #place(
          right+horizon,
          dx: calc.max(progress - 102, -92*1)* 1%,
          dy: height/2,
          text(str(calc.round(progress, digits: 1)).replace(".", ","), size:1.75*unit, weight: "bold", fill: white)
        )

      ]
    )
  )
]
