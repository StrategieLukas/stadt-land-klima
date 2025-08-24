#import "colors.typ"
#import "progress_bar.typ"
#import "circular_barplot.typ"
#import "@preview/rustycure:0.1.0": qr-code

#let Pin = read("/slk_resources/Pin.svg")

#let height = 400;
#let width = height;

#let item_ranking(
    municipality, 
    state, 
    ranking, 
    progress,
    circular_barplot_values,
    unit
  ) = [
  #let color = colors.select_color_from_range(progress);
  #let Pin_colored = Pin.replace("currentColor", color.to-hex())

  #set rect(
    inset: 1.5*unit,
    stroke: 0.5pt + color,
    width: 100%
  )
  // Outer Rectangle
  #rect[
    // Header with Ranking and Place Name
    #grid(
      columns: (6*unit, auto),
      rows: auto,
      gutter: 1*unit,
      align: (center + top, left + top),
      [
        // Pin with Ranking
        #place(
          center + top,
          dy: 1*unit,
          image(
            bytes(Pin_colored),
            width: 100%,
            height: auto,
            alt: "Pin",
            fit: "contain",
          ),
        )
        *#place(center + top, text(str(ranking), size: 4*unit))*
      ],
      [
        // Municipality, State and Progress Bar
        #grid(
          columns: auto,
          rows: (auto, auto, auto),
          gutter: 1*unit,
          text(municipality, size: 4*unit, weight: "bold"),
          text(state, size: 1*unit, fill: gray),
          progress_bar.draw_progress_bar(progress, unit),
        )
      ],
    )

    // Spacer
    #box(height: 2*unit)

    // Circular Barplot
    #align(
      center, 
      circular_barplot.draw(
        circular_barplot_values,
        img_height: .87*height,
        img_width: .87*width,
        unit: 0.08*unit,
        area_scale: false,
        auxiliaryCircles: true,
        background_image: image("/slk_resources/some3.svg", width: 100%),
      )
    )

    // Last updated
    #align(center, text("Letzte Aktualisierung: 28.01.2024, 20:21:59", size: 0.8*unit))

    // QR Code
    #place(right + bottom, qr-code(
      "https://www.stadt-land-klima.de/municipalities/osnabrueck",
      width: 5*unit,
      height: auto,
      alt: "https://www.stadt-land-klima.de/municipalities/osnabrueck",
      quiet-zone: false,
    ))

  ]
]
