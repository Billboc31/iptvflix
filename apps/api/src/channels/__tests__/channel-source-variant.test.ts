import { describe, expect, it } from 'vitest'
import {
  assignChannelSourceDisplayLabels,
  buildChannelSourceDisplayLabel,
  inferChannelSourceCodec,
  inferChannelSourceQuality,
  mapChannelSourceToVariant,
  mapChannelSourcesToVariants,
  type ChannelSourceVariantInput,
} from '../channel-source-variant.js'

const baseRow = (overrides: Partial<ChannelSourceVariantInput> = {}): ChannelSourceVariantInput => ({
  id: 'src-1',
  sourceId: 'provider-1',
  providerName: 'TF1 FHD',
  groupTitle: 'France',
  streamUrl: 'http://x/live/111.ts',
  status: 'AVAILABLE',
  sourceDisplayName: 'Xtream Home',
  ...overrides,
})

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
    const variant = mapChannelSourceToVariant(baseRow())
    expect(variant.id).toBe('src-1')
    expect(variant.videoQuality).toBe('1080p')
    expect(variant.sourceDisplayName).toBe('Xtream Home')
    expect(variant.rawTitle).toBe('TF1 FHD')
    expect(variant.displayLabel).toBe('TF1 FHD')
  })

  it('uses full provider name as display label when unique', () => {
    const label = buildChannelSourceDisplayLabel(
      baseRow({ providerName: 'FR| FRANCE HEVC VIP' }),
      [],
    )
    expect(label).toBe('FR| FRANCE HEVC VIP')
  })

  it('disambiguates duplicate provider names with stream id tail', () => {
    const rows = [
      baseRow({ id: 'a', providerName: 'FR| GÉNÉRAL HD/4K', streamUrl: 'http://x/live/111.ts', groupTitle: null }),
      baseRow({ id: 'b', providerName: 'FR| GÉNÉRAL HD/4K', streamUrl: 'http://x/live/222.ts', groupTitle: null }),
    ]
    const labels = assignChannelSourceDisplayLabels(rows)
    expect(labels.get('a')).toBe('FR| GÉNÉRAL HD/4K')
    expect(labels.get('b')).toBe('FR| GÉNÉRAL HD/4K · 222')
    expect(labels.get('a')).not.toBe(labels.get('b'))
  })

  it('maps all variants with unique display labels', () => {
    const rows = [
      baseRow({ id: 'a', providerName: 'FR| GÉNÉRAL HD/4K', streamUrl: 'http://x/live/111.ts', groupTitle: null }),
      baseRow({ id: 'b', providerName: 'FR| GÉNÉRAL HD/4K', streamUrl: 'http://x/live/222.ts', groupTitle: null }),
    ]
    const variants = mapChannelSourcesToVariants(rows)
    expect(variants.map((v) => v.displayLabel)).toEqual([
      'FR| GÉNÉRAL HD/4K',
      'FR| GÉNÉRAL HD/4K · 222',
    ])
  })
})
