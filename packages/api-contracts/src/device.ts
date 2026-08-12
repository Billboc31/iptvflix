export type PairingCodeResponse = {
  code: string
  expiresAt: string
}

export type PairingStatusResponse = {
  status: 'pending' | 'approved'
  deviceToken?: string
}

export type PairingCodeDetailResponse = {
  code: string
  status: 'pending' | 'approved' | 'expired'
  expiresAt: string
}

export type DeviceResponse = {
  id: string
  name: string
  lastSeenAt: string | null
  revokedAt: string | null
  createdAt: string
}

export type PlaybackCommandRequest = {
  mediaType: 'movie' | 'episode'
  mediaId: string
  availabilityId?: string
  startPositionMs?: number
}

export type PlaybackCommandResponse = {
  id: string
  mediaType: 'movie' | 'episode'
  mediaId: string
  availabilityId: string | null
  startPositionMs: number
  state: 'pending' | 'delivered' | 'acknowledged' | 'expired'
  expiresAt: string
  createdAt: string
}
