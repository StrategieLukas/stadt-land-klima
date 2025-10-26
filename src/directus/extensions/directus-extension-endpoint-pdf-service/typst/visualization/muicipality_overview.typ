#import "utils.typ" as colors
#import "progress_bar.typ"
#import "circular_barplot.typ"
#import "@preview/rustycure:0.1.0": qr-code

#let Pin = read("/slk_resources/Pin.svg")

#let height = 400;
#let width = height;

#let item_ranking(
    municipalityScore,
    unit,
    show_qr_code,
    show_border,
  ) = [
  #let progress = municipalityScore.score_total
  #let ranking = municipalityScore.rank
  #let color = colors.select_color_from_range(progress);
  #let Pin_colored = Pin.replace("currentColor", color.to-hex())

  #let rect_color = color

  #if not show_border{
    rect_color = white
  }
  #set rect(
    inset: 1.3*unit,
    stroke: 1pt + rect_color,
    width: 100%
  )

  #let heading_size = 4*unit

  // Outer Rectangle
  #rect()[
    // Header with Ranking and Place Name
    #align(left)[
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
        *#place(center + top, text(str(ranking), size: heading_size))*
      ],
      [
      #context[
        // Municipality, State and Progress Bar
        #grid(
          columns: auto,
          rows: (auto, auto, auto),
          gutter: 1*unit,
          text(colors.fill-height-with-text(municipalityScore.municipality.name, max: heading_size), weight: "bold"),
          text(municipalityScore.municipality.state, size: 1.2*unit, fill: gray),
          v(unit/2),
          box(width: 28*unit, progress_bar.draw_progress_bar(progress, unit, scale_text : true)),
        )
      ]
      ],
    )
    ]
    // Spacer
    #v(2*unit)

    // Circular Barplot
    #align(
      center,
      circular_barplot.draw(
        municipalityScore,
        img_height: .87*height,
        img_width: .87*width,
        unit: 0.08*unit,
        area_scale: true,
        auxiliaryCircles: false,
        background_image: image("/slk_resources/polar-chart-ring.svg", width: 100%),
      )
    )

    // Last updated
    #align(center, text("Letzte Aktualisierung: " + municipalityScore.date_updated, size: 0.8*unit))

    #let url = "https://www.stadt-land-klima.de/municipalities/" + municipalityScore.municipality.slug
    // QR Code
    #if show_qr_code [
      #place(right + bottom,
        [
          #qr-code(
            url,
            width: 6*unit,
            height: auto,
            alt: url,
            quiet-zone: false,
          )
        ]
      )
      #text(url, size: 0.8*unit)
    ]

  ]
]
