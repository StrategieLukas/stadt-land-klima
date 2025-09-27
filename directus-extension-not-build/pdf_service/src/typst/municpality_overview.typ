#import "visualization/item_ranking.typ"
#import "visualization/rating_utils.typ"
#import "visualization/footer.typ"
#import "visualization/header.typ"
#import "visualization/utils.typ" as util
#import "visualization/progress_bar.typ" as progress_bar
#let unit = 0.75em;

#set text(
  font: "Roboto",
  hyphenate: true,
  lang: "de",
  overhang: false,
  size: 12pt,
)


#set page(
  paper: "a4",
  header: header.header,
  header-ascent: 100% - 2em,
  footer: footer.footer,
  footer-descent: 100% - 1.5em,
  margin: (x: 9mm, y:9mm),
);

// #let data = json(bytes(sys.inputs.data))
#let data = (
    municipality: "Beispielstadt",
    state: "Sachsen",
    ranking: 43,
    circular_barplot_values: (
        energy: 20,
        transport: 40,
        ann: 60,
        iec: 80,
        bh: 15,
        cpma: 100,
    ),
    progress: 22,
)


#align(
  center, 
  box(
    width: 80%,
    [
      #box(
        item_ranking.item_ranking(
          data.municipality,
          data.state,
          data.ranking,
          data.progress,
          data.circular_barplot_values.values(),
          unit,
          true,
          true,
        ),
        width: 100%,
      )
      #align(
        left,
        [
          = Anmerkungen & Aktuelles zur Bewertung
          #lorem(30)
        ]
      )
    
    ]
  )
)

// SECOND PAGE

#pagebreak()

#show table.cell: set text(size: 8pt)
#let progress_bar_height = 0.4em
#grid(
  columns: (33%, 67%),
  align: (center + bottom, center + bottom),

  scale(
    x: 50%,
    y: 50%,
    origin: top + left,
    reflow: true,
    item_ranking.item_ranking(
      data.municipality,
      data.state,
      data.ranking,
      data.progress,
      data.circular_barplot_values.values(),
      unit,
      false,
      false,
    )
  ),
  table(
    columns: (1fr, auto, 5fr, 5fr),
    row-gutter: -0.5em,
    stroke: none,
    table.header(
      [], [*Sektoren*], [*Bewertung der Sektoren*], [*Bewertung der Maßnahmen*]
    ),
    image("slk_resources/icon_category_energy.svg", width: 100%),
    [#align(left+horizon, [*EN - Energie*])],
    align(center+horizon, progress_bar.draw_progress_bar(80, progress_bar_height)),
    align(center+horizon, progress_bar.draw_progress_bar(80, progress_bar_height)),
    image("slk_resources/icon_category_bh.svg", width: 100%),
    [#align(left+horizon, [*GW - Gebäude und Wärme*])],
    align(center+horizon, progress_bar.draw_progress_bar(80, progress_bar_height)),
    align(center+horizon, progress_bar.draw_progress_bar(80, progress_bar_height)),
    image("slk_resources/icon_category_iec.svg", width: 100%),
    [#align(left+horizon, [*IWK - Industrie, Wirtschaft & Konsum*])],
    align(center+horizon, progress_bar.draw_progress_bar(80, progress_bar_height)),
    align(center+horizon, progress_bar.draw_progress_bar(80, progress_bar_height)),
    image("slk_resources/icon_category_cpma.svg", width: 100%),
    [#align(left+horizon, [*KV - Klimaschutz & Verwaltung*])],
    align(center+horizon, progress_bar.draw_progress_bar(80, progress_bar_height)),
    align(center+horizon, progress_bar.draw_progress_bar(80, progress_bar_height)),
    image("slk_resources/icon_category_ann.svg", width: 100%),
    [#align(left+horizon, [*LNE - Landwirtschaft, Natur und Ernährung*])],
    align(center+horizon, progress_bar.draw_progress_bar(80, progress_bar_height)),
    align(center+horizon, progress_bar.draw_progress_bar(80, progress_bar_height)),
    image("slk_resources/icon_category_transport.svg", width: 100%),
    [#align(left+horizon, [*VK - Verkehr*])],
    align(center+horizon, progress_bar.draw_progress_bar(80, progress_bar_height)),
    align(center+horizon, progress_bar.draw_progress_bar(80, progress_bar_height)),
  )
)
// #let tdata = json("tdata.json")

#let table_data = (
  (rating: 10, id: "KV_1", description: "Maßnahme 1", impact: 1, politic: 1, invest: 4),
  (rating: 20, id: "KV_2", description: "Maßnahme 2", impact: 2, politic: 2, invest: 5),
  (rating: 30, id: "KV_3", description: "Sind die Stadtwerke Mitglied bei 'Bundesverband erneuerbare Energien' anstatt Zukunft Gas", impact: 3, politic: 3, invest: 6),
  (rating: 40, id: "KV_4", description: "Maßnahme 4", impact: 4, politic: 4, invest: 7),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
  (rating: 80, id: "KV_5", description: "Maßnahme 5", impact: 5, politic: 5, invest: 8),
)

#let star_generator(num_of_stars) = {
  for (i) in range(0, num_of_stars) {
    text([*★*])
  }
}

#let table_pin(rating) = table.cell(
  fill: white,
)[#align(center+horizon, image(util.select_pin_from_range(rating), height: 1.5em))]


#let color_gray = rgb("#EDEDED")
#show table.cell.where(y: 1): strong
#set table(
  fill: (x, y) =>
    if y == 1{ color_gray },

)

#let legend
#table(
  columns: (8fr, 16fr, 122fr, 21fr, 21fr, 21fr),
  stroke: white + 0.2em,
  rows: (2.5em, 1.4em),
  table.cell(colspan: 3)[
    #stack(
      dir: ltr,
      spacing: 2em,
      "Bewertungsampel\nMaßnahmen",
      box(
        align(center + top)[
          #stack(
            dir: ttb,
            image("slk_resources/icon_rating_0.svg", height: 100%-3pt),  
            text(size: 6pt, fill: gray, "nicht erfüllt"), 
          )
        ]),
      box(
        align(center + horizon)[
          #stack(
            dir: ttb,
            spacing: 3pt,
            image("slk_resources/icon_rating_1.svg", height: 100%-3pt), 
            text(size: 6pt, fill: gray, "1/3 erfüllt"), 
          )
        ]
        
      ),
      box(
        align(center + horizon)[
          #stack(
            dir: ttb,
            spacing: 3pt,
            image("slk_resources/icon_rating_2.svg", height: 100%-3pt), 
            text(size: 6pt, fill: gray, "2/3 erfüllt"), 
          )
        ]
        
        ),
      box(
        align(center + horizon)[
          #stack(
            dir: ttb,
            spacing: 3pt, 
            image("slk_resources/icon_rating_3.svg", height: 100%-3pt), 
            text(size: 6pt, fill: gray, "erfüllt"), 
          )
        ]
      ),
      box(
        align(center + horizon)[
          #stack(
            dir: ttb,
            spacing: 3pt, 
            image("slk_resources/icon_rating_na.svg", height: 100%-3pt), 
            text(size: 6pt, fill: gray, "nicht anwendbar"), 
          )
        ]
      )
    )
  ], 
  [#align(center + horizon, [#image("slk_resources/icon_impact.svg")])], 
  [#align(center + horizon, [#image("slk_resources/icon_politics.svg")])], 
  [#align(center + horizon, [#image("slk_resources/icon_invest.svg")])],
  [], [Nummer], [Maßnahme zur CO2-Reduktion], [Impact], [politische], [invest],
  
  ..for (rating, id, description, impact, politic, invest) in table_data {
    let table_row_color = util.select_color_from_range(rating).transparentize(80%)
    (
      table_pin(rating),
      (
        id, 
        description, 
        star_generator(impact), 
        star_generator(politic), 
        star_generator(invest)
      ).map(cell => (table.cell(fill: table_row_color)[#cell]))
    ).flatten()
    
  }
)
