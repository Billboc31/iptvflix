export type SourceType = 'XTREAM' | 'M3U' | 'PLEX'

export type SourceResponse = {
  id: string
  name: string
  type: SourceType
  baseUrl: string
  username: string | null
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

export type CreateSourceBody = {
  name: string
  type: SourceType
  baseUrl: string
  username?: string | null
  password?: string | null
}

export type UpdateSourceBody = {
  name?: string
  baseUrl?: string
  username?: string | null
  password?: string | null
  enabled?: boolean
}

export type TestSourceResult = {
  ok: boolean
  message: string
}
