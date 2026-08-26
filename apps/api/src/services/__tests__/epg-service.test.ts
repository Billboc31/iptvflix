import { describe, it, expect } from 'vitest'
import {
  parseXmltvDateTime,
  parseXmltvPrograms,
  getEpgNowNext,
  setEpgCacheForTests,
} from '../../services/epg-service.js'

describe('epg-service', () => {
  it('parses xmltv datetime with timezone', () => {
    const iso = parseXmltvDateTime('20250825210000 +0200')
    expect(iso).toMatch(/2025-08-25T19:00:00/)
  })

  it('extracts programmes and resolves now/next', () => {
    const xml = `<?xml version="1.0"?>
<tv>
  <programme start="20250825200000 +0200" stop="20250825210000 +0200" channel="TF1.fr">
    <title lang="fr">Journal</title>
  </programme>
  <programme start="20250825210000 +0200" stop="20250825223000 +0200" channel="TF1.fr">
    <title lang="fr">Série</title>
  </programme>
</tv>`

    const byChannel = parseXmltvPrograms(xml)
    setEpgCacheForTests({ byChannel, fetchedAt: Date.now() })

    const now = new Date('2025-08-25T18:30:00.000Z')
    const { now: current, next } = getEpgNowNext('TF1.fr', { byChannel, fetchedAt: Date.now() }, now)

    expect(current?.title).toBe('Journal')
    expect(next?.title).toBe('Série')
  })
})
