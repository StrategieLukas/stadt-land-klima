#let slk_red = rgb(217, 0, 13)
#let slk_orange = rgb(242, 124, 0)
#let slk_yellow = rgb(255, 212, 0)
#let slk_light_green = rgb(175, 202, 11)
#let slk_dark_green = rgb(29, 166, 74)

#let select_color_from_range(value) = (
  (
    (value >= 0 and value < 20, slk_red),
    (value >= 20 and value < 40, slk_orange),
    (value >= 40 and value < 60, slk_yellow),
    (value >= 60 and value < 80, slk_light_green),
    (value >= 80 and value <= 100, slk_dark_green),
  ).find(c => c.at(0)).at(1)
)

#let select_pin_from_range(value) = (
  (
    (value >= 0 and value < 25, "slk_resources/icon_rating_0.svg"),
    (value >= 25 and value < 50, "slk_resources/icon_rating_1.svg"),
    (value >= 50 and value < 75, "slk_resources/icon_rating_2.svg"),
    (value >= 75 and value <= 100, "slk_resources/icon_rating_3.svg"),
  ).find(c => c.at(0)).at(1)
)