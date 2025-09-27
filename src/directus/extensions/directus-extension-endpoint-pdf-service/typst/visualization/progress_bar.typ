#import "utils.typ" as colors

#let draw_progress_bar(progress, unit, scale_text:false) = [
  #let progress = float(progress)
  #let color = colors.select_color_from_range(progress);
  #let height = 2*unit;
  #let radius = 0.2*unit;

  #let text_size = 8pt;  // default

  #if (scale_text){
    text_size = 1.75*unit;
  }

  #box(
  width: 100%,
    [
      #place(
        horizon,
        rect(stroke: color, fill: color, height: height, width: progress * 1%, radius: radius)
      )
      #place(
        horizon,
        rect(stroke: color, fill: none, height: height, width: (100.0) * 1%, radius: radius)
      )
      #place(
        right+horizon,
        dx: calc.max(progress - 102, -92*1)* 1%,
        text(str(calc.round(progress, digits: 1)).replace(".", ","), size: text_size, weight: "bold", fill: white)
      )

    ]
  )
  
]
