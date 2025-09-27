#let slk_red = rgb(217, 0, 13)
#let slk_orange = rgb(242, 124, 0)
#let slk_yellow = rgb(255, 212, 0)
#let slk_light_green = rgb(175, 202, 11)
#let slk_dark_green = rgb(29, 166, 74)

#let select_color_from_range(value) = (
  (
    (float(value) >= 0 and float(value) < 20, slk_red),
    (float(value) >= 20 and float(value) < 40, slk_orange),
    (float(value) >= 40 and float(value) < 60, slk_yellow),
    (float(value) >= 60 and float(value) < 80, slk_light_green),
    (float(value) >= 80 and float(value) <= 100, slk_dark_green),
  ).find(c => c.at(0)).at(1)
)

#let select_pin_from_range(value) = (
  (
    (float(value) >= 0 and float(value) < 25, "/slk_resources/icon_rating_0.svg"),
    (float(value) >= 25 and float(value) < 50, "/slk_resources/icon_rating_1.svg"),
    (float(value) >= 50 and float(value) < 75, "/slk_resources/icon_rating_2.svg"),
    (float(value) >= 75 and float(value) <= 100, "/slk_resources/icon_rating_3.svg"),
  ).find(c => c.at(0)).at(1)
)


// adapted from https://forum.typst.app/t/how-to-auto-size-text-and-images/1290/2
#let fill-height-with-text(min: 0.1em, max: 5em, eps: 0.1em, it) = layout(size => {
  let height = max.to-absolute()
  let fits(text-size, it) = {
    measure(width: size.width, { set text(text-size); it }).height <= height
  }

  if not fits(min, it) { panic("Content doesn't fit even at minimum text size") }

  let (a, b) = (min, max)
  while b - a > eps {
    let new = 0.5 * (a + b)
    if fits(new, it) {
      a = new
    } else {
      b = new
    }
  }

  set text(a)
  it
})