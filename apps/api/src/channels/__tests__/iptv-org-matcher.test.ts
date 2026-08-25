import { describe, it, expect, beforeAll } from 'vitest'
import { loadIptvOrgCatalog, setIptvOrgCatalogForTests } from '../iptv-org-catalog.js'
import {
  inferChannelCountry,
  languageToPreferredCountry,
  matchIptvOrgChannel,
} from '../iptv-org-matcher.js'

describe('iptv-org matcher', () => {
  beforeAll(async () => {
    setIptvOrgCatalogForTests(null)
    await loadIptvOrgCatalog({ force: true })
  }, 60_000)

  it('matches TF1 HD in FR to TF1.fr', async () => {
    const index = await loadIptvOrgCatalog()
    const hit = matchIptvOrgChannel(index, 'FR | TF1 HD', { groupTitle: 'FR| GENERAL' })
    expect(hit?.id).toBe('TF1.fr')
    expect(hit?.country).toBe('FR')
  })

  it('infers country from prefix', () => {
    expect(inferChannelCountry('FR | M6', 'FR| VIP')).toBe('FR')
  })

  it('maps profile language to preferred country', () => {
    expect(languageToPreferredCountry(['fr'])).toBe('FR')
    expect(languageToPreferredCountry(['en', 'fr'])).toBe('GB')
    expect(languageToPreferredCountry(undefined)).toBe('FR')
  })
})
