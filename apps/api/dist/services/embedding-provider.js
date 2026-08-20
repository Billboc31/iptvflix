import OpenAI from 'openai';
export class OpenAIEmbeddingProvider {
    modelProvider = 'openai';
    modelName = 'text-embedding-3-small';
    dimension = 1536;
    client;
    constructor(apiKey) {
        this.client = new OpenAI({ apiKey });
    }
    async embed(text) {
        const response = await this.client.embeddings.create({
            model: this.modelName,
            input: text,
        });
        return response.data[0].embedding;
    }
    async embedBatch(texts, batchSize = 100) {
        const results = [];
        for (let i = 0; i < texts.length; i += batchSize) {
            const chunk = texts.slice(i, i + batchSize);
            const response = await this.client.embeddings.create({
                model: this.modelName,
                input: chunk,
            });
            const sorted = response.data.sort((a, b) => a.index - b.index);
            results.push(...sorted.map((d) => d.embedding));
        }
        return results;
    }
}
export function createDefaultProvider(apiKey) {
    return new OpenAIEmbeddingProvider(apiKey);
}
//# sourceMappingURL=embedding-provider.js.map