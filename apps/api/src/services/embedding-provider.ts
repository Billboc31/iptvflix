import OpenAI from 'openai'

export interface EmbeddingProvider {
  readonly modelProvider: string
  readonly modelName: string
  readonly dimension: number
  embed(text: string): Promise<number[]>
  embedBatch(texts: string[], batchSize?: number): Promise<number[][]>
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly modelProvider = 'openai'
  readonly modelName = 'text-embedding-3-small'
  readonly dimension = 1536

  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.modelName,
      input: text,
    })
    return response.data[0].embedding
  }

  async embedBatch(texts: string[], batchSize = 100): Promise<number[][]> {
    const results: number[][] = []
    for (let i = 0; i < texts.length; i += batchSize) {
      const chunk = texts.slice(i, i + batchSize)
      const response = await this.client.embeddings.create({
        model: this.modelName,
        input: chunk,
      })
      const sorted = response.data.sort((a, b) => a.index - b.index)
      results.push(...sorted.map((d) => d.embedding))
    }
    return results
  }
}

export function createDefaultProvider(apiKey: string): EmbeddingProvider {
  return new OpenAIEmbeddingProvider(apiKey)
}
