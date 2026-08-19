export interface EngineMetadata {
  engineVersion: string
  embeddingModelVersion: string
  plannerModelVersion: string
  rerankerVersion: string
  timingsMs: Record<string, number>
  fallbackFlags: string[]
}
