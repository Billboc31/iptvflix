export class NotFoundError extends Error {
  readonly statusCode = 404
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`)
  }
}

export class ForbiddenError extends Error {
  readonly statusCode = 403
  constructor(message = 'Forbidden') {
    super(message)
  }
}

export class ValidationError extends Error {
  readonly statusCode = 400
  constructor(message: string) {
    super(message)
  }
}
