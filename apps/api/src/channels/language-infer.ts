/**
 * Infer ISO-ish language codes from IPTV channel names / group titles.
 * Returns lowercase 2-letter codes (fr, en, ar, …) or null when unknown.
 */

const PREFIX_LANG: Record<string, string> = {
  fr: 'fr',
  fra: 'fr',
  france: 'fr',
  be: 'fr',
  bel: 'fr',
  ch: 'fr',
  qc: 'fr',
  en: 'en',
  eng: 'en',
  uk: 'en',
  us: 'en',
  usa: 'en',
  ca: 'en',
  ar: 'ar',
  ara: 'ar',
  arabic: 'ar',
  arab: 'ar',
  it: 'it',
  ita: 'it',
  italy: 'it',
  es: 'es',
  esp: 'es',
  spa: 'es',
  spain: 'es',
  lat: 'es',
  latino: 'es',
  de: 'de',
  ger: 'de',
  deu: 'de',
  german: 'de',
  nl: 'nl',
  ned: 'nl',
  dutch: 'nl',
  pt: 'pt',
  por: 'pt',
  br: 'pt',
  bra: 'pt',
  tr: 'tr',
  tur: 'tr',
  turkish: 'tr',
  pl: 'pl',
  pol: 'pl',
  ru: 'ru',
  rus: 'ru',
  russian: 'ru',
  el: 'el',
  gre: 'el',
  greek: 'el',
  hi: 'hi',
  hin: 'hi',
  indian: 'hi',
  india: 'hi',
  zh: 'zh',
  chi: 'zh',
  cn: 'zh',
  chinese: 'zh',
}

const KEYWORD_LANG: Array<{ re: RegExp; lang: string }> = [
  { re: /\b(france|français|francais|tf1|france\s*\d|m6|canal\+|canal\s*plus|bfm|cnews)\b/i, lang: 'fr' },
  { re: /\b(belgium|belgique|rtl\s*tvi|la\s*une)\b/i, lang: 'fr' },
  { re: /\b(united\s*kingdom|\buk\b|bbc|itv|sky\s*(one|news|sports)|channel\s*4)\b/i, lang: 'en' },
  { re: /\b(usa|united\s*states|american|cbs|nbc|abc\s*us|fox\s*news)\b/i, lang: 'en' },
  { re: /\b(arabic|arabe|al\s*jazeera|mbc|beoutq|osn)\b/i, lang: 'ar' },
  { re: /\b(italian|italia|rai\s*\d|mediaset|sky\s*italia)\b/i, lang: 'it' },
  { re: /\b(spanish|espa[nñ]a|spain|antena\s*3|telecinco)\b/i, lang: 'es' },
  { re: /\b(german|deutschland|deutschland|ard|zdf|prosieben)\b/i, lang: 'de' },
  { re: /\b(dutch|nederland|netherlands|npo\s*\d)\b/i, lang: 'nl' },
  { re: /\b(portuguese|portugal|brazil|brasil|globo)\b/i, lang: 'pt' },
  { re: /\b(turkish|türkiye|turkiye|trt)\b/i, lang: 'tr' },
  { re: /\b(polish|polska|poland)\b/i, lang: 'pl' },
  { re: /\b(russian|russia|россия)\b/i, lang: 'ru' },
]

/** Extract leading IPTV region token: "FR| SPORT", "[EN] BBC", "US - CNN" */
function extractPrefixToken(text: string): string | null {
  const trimmed = text.trim()
  // FR| … or FR - … or FR: …
  const pipe = trimmed.match(/^([A-Za-z]{2,6})\s*[|:\-–—]\s*/)
  if (pipe) return pipe[1]!.toLowerCase()
  // [FR] …
  const bracket = trimmed.match(/^\[([A-Za-z]{2,6})\]\s*/)
  if (bracket) return bracket[1]!.toLowerCase()
  return null
}

export function inferChannelLanguage(
  providerName: string,
  groupTitle?: string | null,
): string | null {
  const haystacks = [groupTitle, providerName].filter((s): s is string => !!s && s.trim().length > 0)

  for (const text of haystacks) {
    const token = extractPrefixToken(text)
    if (token && PREFIX_LANG[token]) return PREFIX_LANG[token]!
  }

  for (const text of haystacks) {
    for (const { re, lang } of KEYWORD_LANG) {
      if (re.test(text)) return lang
    }
  }

  // Loose: whole group title is a known code
  if (groupTitle) {
    const key = groupTitle.toLowerCase().trim()
    if (PREFIX_LANG[key]) return PREFIX_LANG[key]!
  }

  return null
}
