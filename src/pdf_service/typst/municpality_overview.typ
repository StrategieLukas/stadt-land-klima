#import "visualization/item_ranking.typ"
#import "visualization/rating_utils.typ"
#import "visualization/footer.typ"
#import "visualization/header.typ"

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
);

#let data = json(bytes(sys.inputs.data))


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
        ),
        width: 100%,
      ),
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


