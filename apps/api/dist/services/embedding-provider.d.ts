export interface EmbeddingProvider {
    readonly modelProvider: string;
    readonly modelName: string;
    readonly dimension: number;
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[], batchSize?: number): Promise<number[][]>;
}
export declare class OpenAIEmbeddingProvider implements EmbeddingProvider {
    readonly modelProvider = "openai";
    readonly modelName = "text-embedding-3-small";
    readonly dimension = 1536;
    private client;
    constructor(apiKey: string);
    embed(text: string): Promise<number[]>;
    embedBatch(texts: string[], batchSize?: number): Promise<number[][]>;
}
export declare function createDefaultProvider(apiKey: string): EmbeddingProvider;
//# sourceMappingURL=embedding-provider.d.ts.map