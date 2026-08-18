export class IntroDbRateLimitError extends Error {
  readonly retryAfterSec: number
  constructor(retryAfterSec = 60) {
    super('IntroDB rate limit exceeded')
    this.name = 'IntroDbRateLimitError'
    this.retryAfterSec = retryAfterSec
  }
}

export class IntroDbNetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IntroDbNetworkError'
  }
}

export class IntroDbNoDataError extends Error {
  constructor() {
    super('IntroDB returned no segment data')
    this.name = 'IntroDbNoDataError'
  }
}
