#import "utils.typ" as colors
#import "progress_bar.typ"
#import "rating_utils.typ"

#let overview_table_1(sectors, sector_ratings, data_rating) = [
  #table(
    columns: sectors.keys().map(_ => auto),
    table.header(
      ..sectors.values()
    ),
    [ work in progress ]
  )
];

#let overview_table_2(sectors, sector_ratings, data_rating) = [
  #table(
    align: (x, y) => if y == 0 { center } else { left },
    columns: 3,
    table.header(
      [*Sektor*], [*Bewertung*], [*Bewertete Maßnahmen\ (Anzahl)*]
    ),
    ..sectors.pairs()
             .map(pair => (
               link(
                 label(pair.at(0)),
                 "Sektor „" + pair.at(1) + "“"
               ),
               progress_bar.draw_progress_bar(sector_ratings.at(pair.at(0))),
               [
                 #let measures = rating_utils.rating_data_of_sector(data_rating, pair.at(0));
                 #for measure in measures [
                   #let current_measure_color = colors.select_color_from_range(100 * float(measure.rating));
                   #link(
                     label(measure.slug),
                     box(fill: current_measure_color, stroke: current_measure_color)[ ]
                   )
                 ]
                 ( #measures.len() )
               ]
             ))
             .flatten()
  )
];
