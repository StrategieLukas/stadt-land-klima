#import "visualization/header.typ"
#import "visualization/footer.typ"
#import "visualization/utils.typ" as util
#import "visualization/progress_bar.typ" as progress_bar


// #let data = json("sample_data_election.json")
#let data = json(sys.inputs.measureText)

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
  header: header.header(),
  header-ascent: 100% - 2em,
  footer: footer.footer,
  footer-descent: 100% - 1.5em,
  margin: (x: 9mm, top:20mm, bottom:10mm),
);

#let max_potential = data.measure_text.at(0).potential
#v(unit)
== Fragen zur Kommunalwahl auf Basis der Bewertung:

#v(unit)
#for (i, measure) in data.measure_text.enumerate(){
  [
    #box(image(util.select_pin_from_range(measure.rating), height: 1em, fit: "contain"), baseline: 1pt)
    #strong(str(i+1) + ". " +measure.name) (#measure.measure_id)\
    #text(fill: luma(50%), size: 0.75em, [
    Potential: #box(width: 5em, baseline: -3pt)[#progress_bar.draw_progress_bar(measure.potential/max_potential*100, .5em, scale_text: true)] 
    #h(1em)
    Difficulty: #calc.round(float(measure.difficulty), digits: 2)
    // Bewertung: #calc.round(float(measure.rating), digits: 2) 
    // Gewicht: #calc.round(float(measure.weight), digits: 2)
    ])\
    #measure.improvementString. 
    Wie haben Sie vor, dies zu ändern?\
    #v(unit*0.2)
  ]
}

// #data.measure_text