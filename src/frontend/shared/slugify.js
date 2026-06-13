import slugify from 'slugify'

const slugifyConfig = {
  replacement: '-',
  remove: undefined,
  lower: true,
  strict: true,
  locale: 'de',
  trim: true,
}

export function createSlug(value) {
  return slugify(String(value ?? ''), slugifyConfig)
}
