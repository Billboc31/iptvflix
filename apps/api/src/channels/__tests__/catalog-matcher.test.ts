import { describe, it, expect } from 'vitest'
import { parseXmltvFrChannelsPage } from '../xmltv-fr-catalog.js'
import { matchCatalogChannel } from '../catalog-matcher.js'
import type { XmltvFrIndex } from '../xmltv-fr-catalog.js'

const SAMPLE_HTML = `
| Logo | ID | Nom | Lien |
| --- | --- | --- | --- |
| | TF1.fr | TF1 | Voir le programme |
| | Ligue1Plus.fr | Ligue 1+ | Voir le programme |
| | DAZN.fr | DAZN 1 | Voir le programme |
`

describe('parseXmltvFrChannelsPage', () => {
  it('extracts channel ids and names from html table', () => {
    const rows = parseXmltvFrChannelsPage(SAMPLE_HTML)
    expect(rows).toEqual([
      { id: 'TF1.fr', name: 'TF1' },
      { id: 'Ligue1Plus.fr', name: 'Ligue 1+' },
      { id: 'DAZN.fr', name: 'DAZN 1' },
    ])
  })
})

describe('matchCatalogChannel', () => {
  const xmltvIndex: XmltvFrIndex = {
    byId: new Map([
      ['Ligue1Plus.fr', { id: 'Ligue1Plus.fr', name: 'Ligue 1+' }],
      ['DAZN.fr', { id: 'DAZN.fr', name: 'DAZN 1' }],
    ]),
    byNormalizedName: new Map([
      ['ligue 1', [{ id: 'Ligue1Plus.fr', name: 'Ligue 1+' }]],
      ['dazn 1', [{ id: 'DAZN.fr', name: 'DAZN 1' }]],
    ]),
    fetchedAt: Date.now(),
  }

  it('matches by tvg-id against xmltvfr when iptv-org is absent', () => {
    const match = matchCatalogChannel(null, xmltvIndex, 'LIGUE 1+ FHD', {
      tvgId: 'Ligue1Plus.fr',
      countryHint: 'FR',
    })
    expect(match?.id).toBe('Ligue1Plus.fr')
    expect(match?.source).toBe('tvg-id')
  })

  it('matches by normalized name via xmltvfr', () => {
    const match = matchCatalogChannel(null, xmltvIndex, 'DAZN 1 HD', {
      countryHint: 'FR',
    })
    expect(match?.id).toBe('DAZN.fr')
    expect(match?.source).toBe('xmltvfr')
  })
})
