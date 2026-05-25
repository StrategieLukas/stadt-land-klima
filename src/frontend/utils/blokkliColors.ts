/**
 * Shared brand colour palette for blökkli block options.
 *
 * BRAND_COLORS  – use as the `options` value for `displayAs: 'colors'` option entries.
 * BRAND_COLOR_CLASSES – maps each key to the Tailwind prose + text classes for that colour.
 */

export interface BlokkliColorOption {
  label: string
  hex: string
}

export const BRAND_COLORS = {
  default:        { label: 'Standard',    hex: '#111111' },
  black:          { label: 'Schwarz',     hex: '#000000' },
  gray:           { label: 'Grau',        hex: '#505050' },
  white:          { label: 'Weiß',        hex: '#fbfbfb' },
  green:          { label: 'Grün',        hex: '#1da64a' },
  'dark-green':   { label: 'Dunkelgrün',  hex: '#339737' },
  blue:           { label: 'Blau',        hex: '#16bae7' },
  dark:           { label: 'Dunkelblau',  hex: '#006e94' },
  orange:         { label: 'Orange',      hex: '#f39200' },
  yellow:         { label: 'Gelb',        hex: '#ffc80c' },
  lime:           { label: 'Lime',        hex: '#afca0b' },
  red:            { label: 'Rot',         hex: '#e30613' },
} satisfies Record<string, BlokkliColorOption>

export type BrandColorKey = keyof typeof BRAND_COLORS

/**
 * Maps each brand colour key to the Tailwind utility classes that apply the
 * colour inside a `prose` block (paragraphs, headings, strong, links).
 */
export const BRAND_COLOR_CLASSES: Record<BrandColorKey, string> = {
  default:        '',
  black:          'text-black prose-p:text-black prose-headings:text-black',
  gray:           'text-gray prose-p:text-gray prose-headings:text-gray',
  white:          'text-mild-white prose-p:text-mild-white prose-headings:text-mild-white prose-strong:text-mild-white prose-a:text-mild-white',
  green:          'text-ff-green prose-p:text-ff-green prose-headings:text-ff-green',
  'dark-green':   'text-green prose-p:text-green prose-headings:text-green',
  blue:           'text-light-blue prose-p:text-light-blue prose-headings:text-light-blue',
  dark:           'text-stats-dark prose-p:text-stats-dark prose-headings:text-stats-dark',
  orange:         'text-orange prose-p:text-orange prose-headings:text-orange',
  yellow:         'text-localzero-yellow prose-p:text-localzero-yellow prose-headings:text-localzero-yellow',
  lime:           'text-light-green prose-p:text-light-green prose-headings:text-light-green',
  red:            'text-red prose-p:text-red prose-headings:text-red',
}
