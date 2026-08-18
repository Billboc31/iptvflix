export class TheIntroDbRateLimitError extends Error {
  readonly retryAfterSec: number
  constructor(retryAfterSec = 60) {
    super('TheIntroDB rate limit exceeded')
    this.name = 'TheIntroDbRateLimitError'
    this.retryAfterSec = retryAfterSec
  }
}

export class TheIntroDbNetworkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TheIntroDbNetworkError'
  }
}
