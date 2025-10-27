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

#let num_slices = 6;

#let draw_slice(value,
                position,
                img_height,
                img_width,
                unit,
                area_scale: true
               ) = [
  #let value = float(value);
  #let color = colors.select_color_from_range(value);
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
/// `municipalityScore`: A municipalityScore object containing `float` values for scores in the range [0.0;100.0]
#let draw(municipalityScore,
          img_height: 300,
          img_width: 300,
          unit: 1em,
          area_scale: true,
          auxiliaryCircles: true,
          background_image: none
         ) = block[
  #box(height: img_height * unit, width: img_width * unit)[

    #draw_slice(municipalityScore.score_energy, 0, img_height, img_width, unit, area_scale: area_scale)
    #draw_slice(municipalityScore.score_transport, 1, img_height, img_width, unit, area_scale: area_scale)
    #draw_slice(municipalityScore.score_agriculture, 2, img_height, img_width, unit, area_scale: area_scale)
    #draw_slice(municipalityScore.score_industry, 3, img_height, img_width, unit, area_scale: area_scale)
    #draw_slice(municipalityScore.score_buildings, 4, img_height, img_width, unit, area_scale: area_scale)
    #draw_slice(municipalityScore.score_management, 5, img_height, img_width, unit, area_scale: area_scale)

    #for i in range(num_slices) [
      #place(dx: img_width * 0.5 * unit, dy: img_height * 0.5 * unit,
        line(
          stroke: lines,
          start: (0 * unit, 0 * unit),
          end: (
            100 *  calc.sin(i * 2 * calc.pi / num_slices) * unit,
            100 * calc.cos(i * 2 * calc.pi / num_slices) * unit,
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
