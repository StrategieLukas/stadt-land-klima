export function stripHtml(s: string): string {
  return (s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function stripMd(s: string): string {
  return (s || '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // [label](url) → label
    .replace(/[#*_`~>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const BUNDLE_LABELS: Record<string, string> = {
  text: 'Text', richtext: 'Fließtext', heading: 'Überschrift', hero: 'Hero',
  citation: 'Zitat', stat: 'Kennzahl', timeline: 'Zeitstrahl',
  timeline_item: 'Zeitleisten-Eintrag', button: 'Schaltfläche',
  image: 'Bild', video: 'Video', progress_bar: 'Fortschrittsbalken',
}

export function bundleLabel(bundle: string): string {
  return BUNDLE_LABELS[bundle] ?? bundle
}

export function extractBlockText(bundle: string, props: Record<string, any>): string {
  const p = props || {}
  const parts: string[] = []
  const add = (...vals: (string | undefined | null)[]) =>
    vals.forEach(v => v && parts.push(String(v).trim()))

  switch (bundle) {
    case 'text':          parts.push(stripHtml(p.content)); break
    case 'richtext':      parts.push(stripMd(p.content)); break
    case 'heading':       add(p.text); break
    case 'hero':          add(p.title, p.subtitle); break
    case 'citation':      add(p.quote, p.attribution); break
    case 'stat':          add(p.label, p.description, p.value); break
    case 'timeline':      add(p.title); break
    case 'timeline_item': add(p.title, p.description, p.date); break
    case 'button':        add(p.label); break
    case 'image':         add(p.caption, p.alt); break
    case 'video':         add(p.caption); break
    case 'progress_bar':  add(p.label, p.description); break
    default: break
  }

  return parts.filter(Boolean).join(' ')
}

export type SiteContentDoc = {
  id: string
  type: 'block' | 'page' | 'event' | 'article' | 'measure' | 'static_page' | 'news_item'
  title: string
  text: string
  url: string
  meta: string | null
}

// Static (hardcoded Nuxt) pages that are not managed through Directus
export const STATIC_PAGES: Array<{ id: string; title: string; text: string; url: string; meta: string | null }> = [
  {
    id: 'static_municipalities',
    title: 'Gemeinde-Ranking',
    text: 'Gemeinde-Ranking Klimaschutz Bewertung Kommunen Städte Landkreise Übersicht',
    url: '/municipalities',
    meta: 'Übersicht',
  },
  {
    id: 'static_map',
    title: 'Karte',
    text: 'Klimaschutz-Karte Kommunen Gemeinden Karte Deutschland',
    url: '/map',
    meta: 'Übersicht',
  },
  {
    id: 'static_stats',
    title: 'Statistiken',
    text: 'Statistiken Klimaschutz Kommunen Auswertungen Daten Vergleich',
    url: '/stats',
    meta: 'Übersicht',
  },
  {
    id: 'static_measures',
    title: 'Maßnahmenkatalog',
    text: 'Maßnahmenkatalog Klimaschutzmaßnahmen kommunaler Klimaschutz Bewertungskriterien',
    url: '/measures',
    meta: 'Übersicht',
  },
  {
    id: 'static_projects',
    title: 'Projekte',
    text: 'Projekte Klimaschutzprojekte Gemeinden Kommunen Erfolgsgeschichten',
    url: '/projects',
    meta: 'Übersicht',
  },
  {
    id: 'static_feedback',
    title: 'Kontakt',
    text: 'Kontakt Feedback Fehler melden Verbesserungsvorschlag Nachricht',
    url: '/contact',
    meta: 'Übersicht',
  },
  {
    id: 'static_register_localteam',
    title: 'Lokalteam gründen',
    text: 'Lokalteam gründen registrieren Kommune Klimaschutz vor Ort aktiv werden',
    url: '/register_localteam',
    meta: 'Übersicht',
  },
  {
    id: 'static_news',
    title: 'Neuigkeiten',
    text: 'Neuigkeiten News Meldungen Aktuelles Stadt Land Klima',
    url: '/news',
    meta: 'Übersicht',
  },
]

export function buildStaticPageDocs(): SiteContentDoc[] {
  return STATIC_PAGES.map(p => ({ ...p, type: 'static_page' as const }))
}

export function buildNewsItemDoc(item: Record<string, any>): SiteContentDoc | null {
  if (item.status !== 'published') return null
  return {
    id: `news_item_${item.slug}`,
    type: 'news_item',
    title: item.title || '',
    text: stripHtml(item.teaser || ''),
    url: `/news/${item.slug}`,
    meta: null,
  }
}

export function buildPageDoc(page: Record<string, any>): SiteContentDoc | null {
  if (!page.contents) return null
  return {
    id: `page_${page.slug}`,
    type: 'page',
    title: page.name || page.slug,
    text: stripHtml(page.contents),
    url: `/${page.slug}`,
    meta: null,
  }
}

export function buildEventDoc(event: Record<string, any>): SiteContentDoc | null {
  if (event.status !== 'published') return null
  return {
    id: `event_${event.slug}`,
    type: 'event',
    title: event.title || '',
    text: stripHtml(event.description || ''),
    url: `/events/${event.slug}`,
    meta: event.event_type || null,
  }
}

export function buildArticleDoc(article: Record<string, any>): SiteContentDoc | null {
  if (article.status !== 'published') return null
  const text = [
    article.subtitle,
    stripMd(article.abstract || ''),
    stripMd(article.article_text || ''),
  ].filter(Boolean).join(' ')
  return {
    id: `article_${article.slug}`,
    type: 'article',
    title: article.title || '',
    text,
    url: `/projects/${article.slug}`,
    meta: null,
  }
}

const MEASURE_DESC_FIELDS = [
  'description', 'description_about', 'description_benefit',
  'description_evaluation_criteria', 'description_implementation',
  'description_legal', 'description_funding', 'description_verification',
]

export function buildMeasureDoc(measure: Record<string, any>, catalogVersionName?: string): SiteContentDoc | null {
  const text = MEASURE_DESC_FIELDS
    .map(f => stripHtml(measure[f] || ''))
    .filter(Boolean)
    .join(' ')
  const url = catalogVersionName
    ? `/measures/${measure.slug}?v=${encodeURIComponent(catalogVersionName)}`
    : `/measures/${measure.slug}`
  return {
    id: `measure_${measure.slug}`,
    type: 'measure',
    title: measure.name || '',
    text,
    url,
    meta: measure.sector || null,
  }
}

export function buildBlockDoc(
  block: Record<string, any>,
  pageName: string,
  baseUrl = '',
): SiteContentDoc | null {
  const text = extractBlockText(block.bundle, block.props || {})
  if (!text) return null
  return {
    id: `block_${block.uuid}`,
    type: 'block',
    title: pageName || block.entity_uuid,
    text,
    url: `${baseUrl}/${block.entity_uuid}#block-${block.uuid}`,
    meta: bundleLabel(block.bundle),
  }
}
