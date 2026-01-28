#import "visualization/header.typ"
#import "visualization/footer.typ"
#import "visualization/utils.typ" as util
#import "visualization/progress_bar.typ" as progress_bar

#import "visualization/overview_table.typ"
#import "visualization/municipality_overview.typ" as item_ranking


// #let municipalityScore = json("sample_data/municipalityScore.json")
// #let election_guide_questions = json("sample_data/elections_measure_text.json")
// #let rating_measures = json("sample_data/measures.json")


#let municipalityScore = json(sys.inputs.municipalityScore)
#let election_guide_questions = json(sys.inputs.electionGuideText)
#let rating_measures = json(sys.inputs.measures)


#let unit = 1.5em
#set text(
  font: "Roboto",
  hyphenate: true,
  lang: "de",
  overhang: false,
  size: 12pt,
)

#set page(
  paper: "a4",
  footer: footer.footer(footer_text: "Powered by"),
  footer-descent: 100% - 1.5em,
  margin: (x: 10mm, top:20mm, bottom:10mm),
);

#let level2text(level) = [
  #if level == 1 {
    "klein"
  }
  #if level == 2 {
    "niedrig"
  }
  #if level == 3 {
    "mittel"
  }
  #if level == 4 {
    "hoch"
  }
  #if level == 5 {
    "groß"
  }
]

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
        municipalityScore,
        0.75em,
        false,
        false,
      )
    )
  ),
  overview_table.draw_overview_table(municipalityScore, rating_measures)
)

#text(size: 16pt, weight: "bold")[#municipalityScore.municipality.name \ Fragen zur Kommunalwahl:]

#for (i, measure) in election_guide_questions.measure_text.enumerate(){
  box(width: 70%)[
    #box(image(util.select_pin_from_range(measure.rating), height: 1em, fit: "contain"), baseline: 1pt)
    #strong(str(i+1) + ". " + measure.name + " | " + measure.measure_id)\
    #text(fill: luma(30%), size: 10pt, [
    Impact: #level2text(measure.impact),
    Kontroverse: #level2text(measure.feasibility_political),
    Kosten: #level2text(measure.feasibility_economical)
    // Bewertung: #calc.round(float(measure.rating), digits: 2) 
    // Gewicht: #calc.round(float(measure.weight), digits: 2)
    ])\
    #measure.improvementString
    #v(unit*0.5)
  ]
}

// #election_guide_questions.measure_text