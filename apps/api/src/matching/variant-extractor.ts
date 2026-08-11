export interface VariantAttributes {
  audioLanguage: 'fr' | 'en' | null
  subtitleLanguage: 'fr' | null
  videoQuality: '4K' | '1080p' | '720p' | '480p' | null
}

// Order matters: longer/more-specific patterns first to avoid partial matches
const VOSTFR_RE = /\bVOSTFR\b/i
const FR_AUDIO_RE = /\b(TRUEFRENCH|FRENCH|VFF|VF)\b/i
const EN_AUDIO_RE = /\bENG\b/i
const QUALITY_4K_RE = /\b(4K|UHD|2160p)\b/i
const QUALITY_1080_RE = /\b1080p\b/i
const QUALITY_720_RE = /\b720p\b/i
const QUALITY_480_RE = /\b480p\b/i

export function extractVariantAttributes(raw: string): VariantAttributes {
  // VOSTFR = original audio + French subtitles — must be checked before FR_AUDIO_RE
  const isVostfr = VOSTFR_RE.test(raw)

  let audioLanguage: 'fr' | 'en' | null = null
  if (!isVostfr && FR_AUDIO_RE.test(raw)) {
    audioLanguage = 'fr'
  } else if (!isVostfr && EN_AUDIO_RE.test(raw)) {
    audioLanguage = 'en'
  }

  const subtitleLanguage: 'fr' | null = isVostfr ? 'fr' : null

  let videoQuality: '4K' | '1080p' | '720p' | '480p' | null = null
  if (QUALITY_4K_RE.test(raw)) {
    videoQuality = '4K'
  } else if (QUALITY_1080_RE.test(raw)) {
    videoQuality = '1080p'
  } else if (QUALITY_720_RE.test(raw)) {
    videoQuality = '720p'
  } else if (QUALITY_480_RE.test(raw)) {
    videoQuality = '480p'
  }

  return { audioLanguage, subtitleLanguage, videoQuality }
}
