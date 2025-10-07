#import "visualization/muicipality_overview.typ" as item_ranking
#import "visualization/footer.typ"
#import "visualization/header.typ"
#import "visualization/utils.typ" as util
#import "visualization/progress_bar.typ" as progress_bar
#import "visualization/overview_table.typ"
#import "visualization/rated_measures_table.typ"


#let municipality = json(sys.inputs.municipality)
#let rating_measures = json(sys.inputs.measures)

// #let municipality = json("sample_data/municipality.json")
// #let rating_measures = json("sample_data/sorted_measures.json")


#let unit = 0.75em;

#set text(
  font: "Roboto",
  hyphenate: true,
  lang: "de",
  overhang: false,
  size: 12pt,
)

#let is_major_city = util.is_major_city(municipality.population)
#set page(
  paper: "a4",
  header: header.header(is_major_city: is_major_city),
  header-ascent: 100% - 2em,
  footer: footer.footer,
  footer-descent: 100% - 1.5em,
  margin: (x: 9mm, top:20mm, bottom:10mm),
);

#v(2*unit)
#align(
  center, 
  box(
    width: 70%,
    [
      #box(
        item_ranking.item_ranking(
          municipality,
          unit,
          true,
          true,
        ),
        width: 100%,
      )
      #align(
        left,
        [
          #if(municipality.overall_status_comment != none){
          [
            = Anmerkungen & Aktuelles zur Bewertung
            #text(municipality.overall_status_comment)]
          }
        ]
      )
    
    ]
  )
)

// SECOND PAGE

#pagebreak()

#show table.cell: set text(size: 8pt)
#grid(
  columns: (33%, 67%),
  align: (center + bottom, center + bottom),

  place(dy: -1.5cm,
    scale(
      x: 50%,
      y: 50%,
      origin: top + left,
      reflow: true,
      item_ranking.item_ranking(
        municipality,
        unit,
        false,
        false,
      )
    )
  ),
  overview_table.draw_overview_table(municipality, rating_measures)
)

#rated_measures_table.draw_measures_table(rating_measures)