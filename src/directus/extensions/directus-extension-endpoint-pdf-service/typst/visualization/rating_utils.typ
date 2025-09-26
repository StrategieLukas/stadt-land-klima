#let sectors() = (
  (
    "energy": "Energie",
    "transport": "Verkehr",
    "ann": "Landwirtschaft, Natur & Ernährung",
    "iec": "Industrie, Wirtschaft & Konsum",
    "bh": "Gebäude & Wärme",
    "cpma": "Klimaschutzmanagement & Verwaltung",
  )
);

#let extract_rating_of_sectors_from_municipality(municipality_data) = (
  (
    "energy": float(municipality_data.score_energy),
    "transport": float(municipality_data.score_transport),
    "ann": float(municipality_data.score_ann),
    "iec": float(municipality_data.score_iec),
    "bh": float(municipality_data.score_bh),
    "cpma": float(municipality_data.score_cpma),
  )
);

#let rating_data_of_sector(all_data, sector) = (
  all_data
    .filter(data_element => data_element.measure_id.sector == sector)
    .map(
      data_element => (
        "name": data_element.measure_id.name,
        "sector": data_element.measure_id.sector,
        "slug": data_element.measure_id.slug,
        "description_about": data_element.measure_id.description_about,
        "description_evaluation_criteria": data_element.measure_id.description_evaluation_criteria,
        "description_verification": data_element.measure_id.description_verification,
        "rating": data_element.rating,
        "current_progress": data_element.current_progress,
        "source": data_element.source,
        "date_updated": data_element.date_updated,
      )
    )
    .sorted(key: element => -float(element.rating))
);
