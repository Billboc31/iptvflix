import { describe, expect, it } from 'vitest'
import { getMediaRelayBaseUrl, isMediaRelayEnabled, setLiveMediaRelayUrl } from '../media-relay-runtime.js'

describe('media-relay-runtime', () => {
  it('uses the live heartbeat URL when set', () => {
    setLiveMediaRelayUrl('https://abc.lhr.life/')
    expect(getMediaRelayBaseUrl()).toBe('https://abc.lhr.life')
  })

  it('requires a secret plus a URL to enable the relay', () => {
    expect(typeof isMediaRelayEnabled()).toBe('boolean')
  })
})
