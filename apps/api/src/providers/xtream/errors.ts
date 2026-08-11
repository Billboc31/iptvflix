export class XtreamAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'XtreamAuthError'
  }
}

export class XtreamNetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'XtreamNetworkError'
  }
}

export class XtreamParseError extends Error {
  constructor(endpoint: string) {
    super(`Unexpected response shape from ${endpoint}`)
    this.name = 'XtreamParseError'
  }
}
