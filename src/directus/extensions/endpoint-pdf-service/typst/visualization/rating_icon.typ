#import "utils.typ" as util


#let rating_icon(value) = {
  let icon = util.select_pin_from_range(value)
  let label = util.select_label_from_range(value)

  stack(
    dir: ttb,
    spacing: 4pt,

    image(icon, height: 2.5em, fit: "contain"),
    text(size: 12pt, label),
  )
}
