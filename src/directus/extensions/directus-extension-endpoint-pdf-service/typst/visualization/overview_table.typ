#import "progress_bar.typ" as progress_bar
#import "rating_bars.typ"

#let progress_bar_height = 0.7em


#let draw_overview_table(municipality, sorted_measures) = (
table(
    columns: (1cm, auto, 3.1cm, 3.5cm),
    row-gutter: -0.5em,
    stroke: none,
    align: left+horizon,
    table.header(
      [], [*Sektoren*], [*Bewertung der Sektoren*], [*Bewertung der Maßnahmen*]
    ),
    image("../slk_resources/icon_category_energy.svg", width: 100%),
    [*EN - Energie*],
    progress_bar.draw_progress_bar(municipality.score_energy, progress_bar_height),
    rating_bars.draw_rating_bars(sorted_measures.energy, progress_bar_height),
    image("../slk_resources/icon_category_buildings.svg", width: 100%),
    [*GW - Gebäude und Wärme*],
    progress_bar.draw_progress_bar(municipality.score_buildings, progress_bar_height),
    rating_bars.draw_rating_bars(sorted_measures.buildings, progress_bar_height),
    image("../slk_resources/icon_category_industry.svg", width: 100%),
    [*IWK - Industrie, Wirtschaft & Konsum*],
    progress_bar.draw_progress_bar(municipality.score_industry, progress_bar_height),
    rating_bars.draw_rating_bars(sorted_measures.industry, progress_bar_height),
    image("../slk_resources/icon_category_management.svg", width: 100%),
    [*KV - Klimaschutz & Verwaltung*],
    progress_bar.draw_progress_bar(municipality.score_management, progress_bar_height),
    rating_bars.draw_rating_bars(sorted_measures.management, progress_bar_height),
    image("../slk_resources/icon_category_agriculture.svg", width: 100%),
    [*LNE - Landwirtschaft, Natur und Ernährung*],
    progress_bar.draw_progress_bar(municipality.score_agriculture, progress_bar_height),
    rating_bars.draw_rating_bars(sorted_measures.agriculture, progress_bar_height),
    image("../slk_resources/icon_category_transport.svg", width: 100%),
    [*VK - Verkehr*],
    progress_bar.draw_progress_bar(municipality.score_transport, progress_bar_height),
    rating_bars.draw_rating_bars(sorted_measures.transport, progress_bar_height),
  )
)
