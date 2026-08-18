export type EmbeddingIndexMode = 'pgvector' | 'float8'

let mode: EmbeddingIndexMode = 'float8'

export function getEmbeddingIndexMode(): EmbeddingIndexMode {
  return mode
}

export function setEmbeddingIndexMode(next: EmbeddingIndexMode): void {
  mode = next
}
