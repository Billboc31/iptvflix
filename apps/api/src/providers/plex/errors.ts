export class PlexAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlexAuthError'
  }
}

export class PlexNetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlexNetworkError'
  }
}

export class PlexParseError extends Error {
  constructor(endpoint: string) {
    super(`Unexpected response shape from ${endpoint}`)
    this.name = 'PlexParseError'
  }
}
