/**
 * One-shot backfill: infer channels.language + remap categories to canonical ids.
 *
 * Uses the same heuristics as language-infer.ts / category-mapper.ts (inlined for
 * a standalone .mjs runnable with node + postgres).
 *
 * From apps/api/:
 *   DATABASE_URL=<url> node scripts/backfill-channel-language.mjs
 */
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const BATCH = 200

const PREFIX_LANG = {
  fr: 'fr', fra: 'fr', france: 'fr', be: 'fr', bel: 'fr', ch: 'fr', qc: 'fr',
  en: 'en', eng: 'en', uk: 'en', us: 'en', usa: 'en', ca: 'en',
  ar: 'ar', ara: 'ar', arabic: 'ar', arab: 'ar',
  it: 'it', ita: 'it', italy: 'it',
  es: 'es', esp: 'es', spa: 'es', spain: 'es', lat: 'es', latino: 'es',
  de: 'de', ger: 'de', deu: 'de', german: 'de',
  nl: 'nl', ned: 'nl', dutch: 'nl',
  pt: 'pt', por: 'pt', br: 'pt', bra: 'pt',
  tr: 'tr', tur: 'tr', turkish: 'tr',
  pl: 'pl', pol: 'pl',
  ru: 'ru', rus: 'ru', russian: 'ru',
  el: 'el', gre: 'el', greek: 'el',
  hi: 'hi', hin: 'hi', indian: 'hi', india: 'hi',
  zh: 'zh', chi: 'zh', cn: 'zh', chinese: 'zh',
}

const KEYWORD_LANG = [
  { re: /\b(france|français|francais|tf1|france\s*\d|m6|canal\+|canal\s*plus|bfm|cnews)\b/i, lang: 'fr' },
  { re: /\b(belgium|belgique|rtl\s*tvi|la\s*une)\b/i, lang: 'fr' },
  { re: /\b(united\s*kingdom|\buk\b|bbc|itv|sky\s*(one|news|sports)|channel\s*4)\b/i, lang: 'en' },
  { re: /\b(usa|united\s*states|american|cbs|nbc|abc\s*us|fox\s*news)\b/i, lang: 'en' },
  { re: /\b(arabic|arabe|al\s*jazeera|mbc|beoutq|osn)\b/i, lang: 'ar' },
  { re: /\b(italian|italia|rai\s*\d|mediaset|sky\s*italia)\b/i, lang: 'it' },
  { re: /\b(spanish|espa[nñ]a|spain|antena\s*3|telecinco)\b/i, lang: 'es' },
  { re: /\b(german|deutschland|ard|zdf|prosieben)\b/i, lang: 'de' },
  { re: /\b(dutch|nederland|netherlands|npo\s*\d)\b/i, lang: 'nl' },
  { re: /\b(portuguese|portugal|brazil|brasil|globo)\b/i, lang: 'pt' },
  { re: /\b(turkish|türkiye|turkiye|trt)\b/i, lang: 'tr' },
  { re: /\b(polish|polska|poland)\b/i, lang: 'pl' },
  { re: /\b(russian|russia)\b/i, lang: 'ru' },
]

const CATEGORY_MAP = {
  general: 'generalist', généraliste: 'generalist', generalist: 'generalist',
  generaliste: 'generalist', général: 'generalist',
  sport: 'sport', sports: 'sport', football: 'sport', soccer: 'sport',
  tennis: 'sport', dazn: 'sport', beinsport: 'sport', 'bein sport': 'sport',
  ligue: 'sport', ppv: 'sport',
  cinema: 'cinema', cinéma: 'cinema', film: 'cinema', films: 'cinema',
  movie: 'cinema', movies: 'cinema', series: 'cinema', séries: 'cinema', vod: 'cinema',
  news: 'news', info: 'news', actualité: 'news', actualites: 'news', information: 'news',
  kids: 'kids', enfants: 'kids', children: 'kids', jeunesse: 'kids',
  animation: 'kids', junior: 'kids',
  music: 'music', musique: 'music', musical: 'music',
  documentary: 'documentary', documentaire: 'documentary', documentaries: 'documentary',
  nature: 'documentary', science: 'documentary', discovery: 'documentary',
  entertainment: 'entertainment', divertissement: 'entertainment',
  variety: 'entertainment', variété: 'entertainment', varieté: 'entertainment',
  international: 'international', arabic: 'international', arab: 'international',
  turkish: 'international', indian: 'international',
}

function extractPrefixToken(text) {
  const trimmed = text.trim()
  const pipe = trimmed.match(/^([A-Za-z]{2,6})\s*[|:\-–—]\s*/)
  if (pipe) return pipe[1].toLowerCase()
  const bracket = trimmed.match(/^\[([A-Za-z]{2,6})\]\s*/)
  if (bracket) return bracket[1].toLowerCase()
  return null
}

function inferChannelLanguage(providerName, groupTitle) {
  const haystacks = [groupTitle, providerName].filter((s) => !!s && String(s).trim().length > 0)
  for (const text of haystacks) {
    const token = extractPrefixToken(text)
    if (token && PREFIX_LANG[token]) return PREFIX_LANG[token]
  }
  for (const text of haystacks) {
    for (const { re, lang } of KEYWORD_LANG) {
      if (re.test(text)) return lang
    }
  }
  if (groupTitle) {
    const key = groupTitle.toLowerCase().trim()
    if (PREFIX_LANG[key]) return PREFIX_LANG[key]
  }
  return null
}

function stripRegionPrefix(raw) {
  return raw
    .replace(/^\s*\[[A-Za-z]{2,6}\]\s*/i, '')
    .replace(/^\s*[A-Za-z]{2,6}\s*[|:\-–—]\s*/i, '')
    .trim()
}

function mapCategory(raw) {
  const stripped = stripRegionPrefix(raw)
  const key = stripped.toLowerCase().trim()
  if (!key) return 'other'
  if (key in CATEGORY_MAP) return CATEGORY_MAP[key]
  for (const [pattern, canonical] of Object.entries(CATEGORY_MAP)) {
    if (key.includes(pattern)) return canonical
  }
  const original = raw.toLowerCase()
  for (const [pattern, canonical] of Object.entries(CATEGORY_MAP)) {
    if (original.includes(pattern)) return canonical
  }
  return 'other'
}

function remapCategories(raw) {
  const list = Array.isArray(raw) ? raw : []
  const mapped = list.map((c) => mapCategory(String(c)))
  return [...new Set(mapped.length ? mapped : ['other'])]
}

function catsEqual(a, b) {
  const as = [...(a ?? [])].map(String).sort()
  const bs = [...(b ?? [])].map(String).sort()
  if (as.length !== bs.length) return false
  return as.every((v, i) => v === bs[i])
}

const sql = postgres(url, { max: 5 })

try {
  console.log('[backfill] Loading channels + primary source metadata…')

  const rows = await sql`
    SELECT
      c.id,
      c.canonical_name,
      c.language,
      c.categories,
      cs.provider_name,
      cs.group_title
    FROM channels c
    LEFT JOIN LATERAL (
      SELECT provider_name, group_title
      FROM channel_sources
      WHERE channel_id = c.id
      ORDER BY priority DESC, last_seen_at DESC
      LIMIT 1
    ) cs ON true
  `

  console.log(`[backfill] ${rows.length} channels`)

  const updates = []
  let langUpdated = 0
  let catUpdated = 0

  for (const row of rows) {
    const name = row.provider_name || row.canonical_name
    const group = row.group_title
    const language = inferChannelLanguage(name, group)
    const sourceCats = row.categories?.length ? row.categories : (group ? [group] : [])
    const categories = remapCategories(sourceCats)

    const langChanged = Boolean(language && row.language !== language)
    const catChanged = !catsEqual(row.categories, categories)
    if (!langChanged && !catChanged) continue

    if (langChanged) langUpdated++
    if (catChanged) catUpdated++

    updates.push({
      id: row.id,
      language: language ?? row.language,
      categories,
    })
  }

  console.log(`[backfill] ${updates.length} rows to update (lang≈${langUpdated}, cats≈${catUpdated})`)

  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH)
    const ids = chunk.map((u) => u.id)
    const langs = chunk.map((u) => u.language)
    const cats = chunk.map((u) => JSON.stringify(u.categories))

    await sql`
      UPDATE channels AS c
      SET
        language = COALESCE(data.language, c.language),
        categories = data.categories::jsonb,
        updated_at = now()
      FROM unnest(
        ${ids}::uuid[],
        ${langs}::text[],
        ${cats}::text[]
      ) AS data(id, language, categories)
      WHERE c.id = data.id
    `
    console.log(`[backfill] wrote ${Math.min(i + BATCH, updates.length)}/${updates.length}`)
  }

  console.log('[backfill] done')
} catch (err) {
  console.error('[backfill] failed:', err)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
