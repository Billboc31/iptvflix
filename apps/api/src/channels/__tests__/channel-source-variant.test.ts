import { describe, expect, it } from 'vitest'
import {
  inferChannelSourceCodec,
  inferChannelSourceQuality,
  mapChannelSourceToVariant,
} from '../channel-source-variant.js'

describe('channel-source-variant', () => {
  it('infers 4K from provider name', () => {
    expect(inferChannelSourceQuality(['TF1 UHD', '', ''])).toBe('4K')
  })

  it('infers 1080p from FHD suffix', () => {
    expect(inferChannelSourceQuality(['Arte FHD', '', ''])).toBe('1080p')
  })

  it('infers HEVC codec', () => {
    expect(inferChannelSourceCodec(['Canal+ 4K HEVC', '', ''])).toBe('HEVC')
  })

  it('maps channel source row to availability variant', () => {
    const variant = mapChannelSourceToVariant({
      id: 'src-1',
      sourceId: 'provider-1',
      providerName: 'TF1 FHD',
      groupTitle: 'France',
      streamUrl: 'http://x/live/1.ts',
      status: 'AVAILABLE',
      sourceDisplayName: 'Xtream Home',
    })
    expect(variant.id).toBe('src-1')
    expect(variant.videoQuality).toBe('1080p')
    expect(variant.sourceDisplayName).toBe('Xtream Home')
    expect(variant.rawTitle).toBe('TF1 FHD')
  })
})
