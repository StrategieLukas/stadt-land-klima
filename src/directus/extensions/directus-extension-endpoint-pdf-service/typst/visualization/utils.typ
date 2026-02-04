#let slk_red = rgb(217, 0, 13)
#let slk_orange = rgb(242, 124, 0)
#let slk_yellow = rgb(255, 212, 0)
#let slk_light_green = rgb(175, 202, 11)
#let slk_dark_green = rgb(29, 166, 74)
#let slk_gray = rgb(155,155,155)

#let select_color_from_range(value, factor : 1) = {
  let parsed_value = 0
  if(value == none){
    slk_gray
  }else{
    parsed_value = float(value) * factor
    (
      (parsed_value >= 0 and parsed_value < 20, slk_red),
      (parsed_value >= 20 and parsed_value < 40, slk_orange),
      (parsed_value >= 40 and parsed_value < 60, slk_yellow),
      (parsed_value >= 60 and parsed_value < 80, slk_light_green),
      (parsed_value >= 80 and parsed_value <= 100, slk_dark_green),
    ).find(c => c.at(0)).at(1)
  }
}

#let select_pin_from_range(value) = {
  if(value == none){
    "/slk_resources/icon_rating_na.svg"
  }else{
    let parsed_value = float(value) * 100
    (
      (parsed_value >= 0 and parsed_value < 25, "/slk_resources/icon_rating_0.svg"),
      (parsed_value >= 25 and parsed_value < 50, "/slk_resources/icon_rating_1.svg"),
      (parsed_value >= 50 and parsed_value < 75, "/slk_resources/icon_rating_2.svg"),
      (parsed_value >= 75 and parsed_value < 99, "/slk_resources/icon_rating_3.svg"),
      (parsed_value > 99, "/slk_resources/icon_rating_4.svg"),
    ).find(c => c.at(0)).at(1)
  }
}

#let select_label_from_range(value) = {
  if value == none {
    "nicht anwendbar"
  } else {
    let parsed_value = float(value) * 100
    (
      (parsed_value >= 0 and parsed_value < 25, "nicht erfüllt"),
      (parsed_value >= 25 and parsed_value < 50, "ansatzweise erfüllt"),
      (parsed_value >= 50 and parsed_value < 75, "halbwegs erfüllt"),
      (parsed_value >= 75 and parsed_value < 99, "größtenteils erfüllt"),
      (parsed_value > 99, "vollständig erfüllt"),
    ).find(c => c.at(0)).at(1)
  }
}



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

// Typst does not support any datetime parsers yet, so have to manually do string manipulation
#let format-datetime = s => {
  let y = s.slice(0, 4)
  let m = s.slice(5, 7)
  let d = s.slice(8, 10)
  let h = s.slice(11, 13)
  let min = s.slice(14, 16)
  d + "." + m + "." + y + " um " + h + ":" + min
}

