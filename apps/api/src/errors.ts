export class NotFoundError extends Error {
  readonly statusCode = 404
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`)
  }
}
