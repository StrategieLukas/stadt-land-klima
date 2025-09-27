#import "utils.typ" as colors

/// 100²*pi = a
/// x²*pi = a*(val/100)
/// => x = sqrt(100*val)
#let scale(value, area_scale: false) = (
  if area_scale {
    calc.sqrt(100 * value)
  } else {
    value
  }
)

#let draw_slice(values,
                position,
                img_height,
                img_width,
                unit,
                area_scale: true
               ) = [
  #let num_slices = values.len();
  #let value = values.at(position);
  #let color = colors.select_color_from_range(values.at(position));
  #let radius = scale(value, area_scale: area_scale);
  #let arc_0 = position * 2 * calc.pi / num_slices;
  #let arc_3 = (position + 1) * 2 * calc.pi / num_slices;
  #let p0_x = (radius * calc.sin(arc_0)) * unit;
  #let p0_y = (-radius * calc.cos(arc_0)) * unit;
  #let p3_x = (radius * calc.sin(arc_3)) * unit;
  #let p3_y = (-radius * calc.cos(arc_3)) * unit;

  #let dist = radius * 4/3 * calc.tan(calc.pi / (2 * num_slices));
  #let p1_x = p0_x + dist * calc.sin(arc_0 + calc.pi / 2) * unit;
  #let p1_y = p0_y - dist * calc.cos(arc_0 + calc.pi / 2) * unit;
  #let p2_x = p3_x - dist * calc.sin(arc_3 + calc.pi / 2) * unit;
  #let p2_y = p3_y + dist * calc.cos(arc_3 + calc.pi / 2) * unit;

  #place(dx: img_width * 0.5 * unit, dy: img_height * 0.5 * unit,
    curve(
      fill: color,
      stroke: color,
      curve.move((0 * unit, 0 * unit), relative: false),
      curve.line((p0_x, p0_y), relative: false),
      curve.cubic((p1_x, p1_y), (p2_x, p2_y), (p3_x, p3_y), relative: false),
      curve.line((0 * unit, 0 * unit), relative: false),
    )
  )
]

#let lines = 1pt + gray
/// `values`: An array of `float` values in the range [0.0;100.0]
#let draw(values,
          img_height: 300,
          img_width: 300,
          unit: 1em,
          area_scale: true,
          auxiliaryCircles: true,
          background_image: none
         ) = block[
  #box(height: img_height * unit, width: img_width * unit)[
    #for i in range(values.len()) [
      #draw_slice(values, i, img_height, img_width, unit, area_scale: area_scale)
    ]
    #for i in range(values.len()) [
      #place(dx: img_width * 0.5 * unit, dy: img_height * 0.5 * unit,
        line(
          stroke: lines,
          start: (0 * unit, 0 * unit),
          end: (
            100 *  calc.sin(i * 2 * calc.pi / values.len()) * unit,
            100 * calc.cos(i * 2 * calc.pi / values.len()) * unit,
          ),
        )
      )
    ]
    #if auxiliaryCircles [
      #place(center+horizon, circle(stroke: lines, radius: 100 * unit))
      #place(center+horizon, circle(stroke: lines, radius: 80 * unit))
      #place(center+horizon, circle(stroke: lines, radius: 60 * unit))
      #place(center+horizon, circle(stroke: lines, radius: 40 * unit))
      #place(center+horizon, circle(stroke: lines, radius: 20 * unit))
    ]
    #if background_image != none [
      #place(center+horizon, background_image)
    ]
  ]
]
