export interface VariantAttributes {
  audioLanguage: 'fr' | 'en' | null
  subtitleLanguage: 'fr' | null
  videoQuality: '4K' | '1080p' | '720p' | '480p' | null
  codecName: string | null
  hdrFormat: string | null
  releaseHint: string | null
  audioFormat: string | null
}

// Order matters: longer/more-specific patterns first to avoid partial matches
const VOSTFR_RE = /\bVOSTFR\b/i
const FR_AUDIO_RE = /\b(TRUEFRENCH|FRENCH|VFF|VF|FR)\b/i
const EN_AUDIO_RE = /\b(ENG|EN)\b/i
const QUALITY_4K_RE = /\b(4K|UHD|2160p)\b/i
const QUALITY_1080_RE = /\b1080p\b/i
const QUALITY_720_RE = /\b720p\b/i
const QUALITY_480_RE = /\b480p\b/i

// Codec detection — H.265 checked before H.264 to avoid partial overlap
const CODEC_H265_RE = /\b(H\.?265|HEVC|x265)\b/i
const CODEC_H264_RE = /\b(H\.?264|AVC|x264)\b/i

// HDR — HDR10 checked before generic HDR; DV before generic HDR
const HDR10_RE = /\bHDR10\b/i
const DV_RE = /\b(DolbyVision|Dolby\.Vision|DV)\b/i
const HLG_RE = /\bHLG\b/i
const HDR_RE = /\bHDR\b/i

// Release hint — more specific patterns first
const WEBDL_RE = /\bWEB[-.]?DL\b/i
const WEBRIP_RE = /\bWEB[-.]?Rip\b/i
const BLURAY_RE = /\b(Blu[-.]?Ray|BDRip|BRRip)\b/i
const HDCAM_RE = /\bHDCAM\b/i
const HDTV_RE = /\bHDTV\b/i
const CAM_RE = /\bCAM\b/i

// Audio format — TrueHD/Atmos before generic DTS/STEREO
const MULTI_RE = /\bMULTi?\b/i
const TRUEHD_RE = /\bTrueHD\b/i
const ATMOS_RE = /\bAtmos\b/i
const DTS_RE = /\bDTS\b/i
const AUDIO_51_RE = /\b5\.1\b/
const STEREO_RE = /\bSTEREO\b/i

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

  let codecName: string | null = null
  if (CODEC_H265_RE.test(raw)) {
    codecName = 'H.265'
  } else if (CODEC_H264_RE.test(raw)) {
    codecName = 'H.264'
  }

  let hdrFormat: string | null = null
  if (HDR10_RE.test(raw)) {
    hdrFormat = 'HDR10'
  } else if (DV_RE.test(raw)) {
    hdrFormat = 'Dolby Vision'
  } else if (HLG_RE.test(raw)) {
    hdrFormat = 'HLG'
  } else if (HDR_RE.test(raw)) {
    hdrFormat = 'HDR'
  }

  let releaseHint: string | null = null
  if (WEBDL_RE.test(raw)) {
    releaseHint = 'WEB-DL'
  } else if (WEBRIP_RE.test(raw)) {
    releaseHint = 'WEBRip'
  } else if (BLURAY_RE.test(raw)) {
    releaseHint = 'Blu-ray'
  } else if (HDCAM_RE.test(raw)) {
    releaseHint = 'HDCAM'
  } else if (HDTV_RE.test(raw)) {
    releaseHint = 'HDTV'
  } else if (CAM_RE.test(raw)) {
    releaseHint = 'CAM'
  }

  let audioFormat: string | null = null
  if (MULTI_RE.test(raw)) {
    audioFormat = 'MULTI'
  } else if (TRUEHD_RE.test(raw)) {
    audioFormat = 'TrueHD'
  } else if (ATMOS_RE.test(raw)) {
    audioFormat = 'Atmos'
  } else if (DTS_RE.test(raw)) {
    audioFormat = 'DTS'
  } else if (AUDIO_51_RE.test(raw)) {
    audioFormat = '5.1'
  } else if (STEREO_RE.test(raw)) {
    audioFormat = 'STEREO'
  }

  return { audioLanguage, subtitleLanguage, videoQuality, codecName, hdrFormat, releaseHint, audioFormat }
}
