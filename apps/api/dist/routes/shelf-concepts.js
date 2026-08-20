import OpenAI from 'openai';
import { db } from '../db/client.js';
import { EmbeddingService } from '../services/embedding-service.js';
import { SemanticRetrievalService } from '../services/semantic-retrieval-service.js';
import { createDefaultProvider } from '../services/embedding-provider.js';
import { ShelfConceptGeneratorService } from '../services/shelf-concept-generator-service.js';
import { OPENAI_API_KEY, SHELF_CONCEPT_LLM_MODEL, } from '../config/env.js';
import { RecommendationEngineClient } from '../client/recommendation-engine-client.js';
function buildService() {
    const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
    const embeddingProvider = OPENAI_API_KEY ? createDefaultProvider(OPENAI_API_KEY) : null;
    const embeddingService = embeddingProvider ? new EmbeddingService(db, embeddingProvider) : null;
    const semanticRetrieval = embeddingService
        ? new SemanticRetrievalService(db, embeddingService)
        : null;
    return new ShelfConceptGeneratorService(db, openai, embeddingProvider, semanticRetrieval, SHELF_CONCEPT_LLM_MODEL);
}
const service = buildService();
function handleError(err, reply) {
    if (err instanceof Error && err.message.includes('not configured')) {
        return reply.status(503).send({ error: err.message });
    }
    throw err;
}
export async function shelfConceptsRoutes(app) {
    app.post('/shelf-concepts/generate', async (request, reply) => {
        const { profileId, count } = request.body ?? {};
        if (!profileId || typeof profileId !== 'string') {
            return reply.status(400).send({ error: 'profileId is required' });
        }
        if (count !== undefined && (typeof count !== 'number' || count < 1 || count > 100)) {
            return reply.status(400).send({ error: 'count must be a number between 1 and 100' });
        }
        const engineResult = await RecommendationEngineClient.generateShelfConcepts({ profileId, count });
        if (engineResult) {
            return reply.send(engineResult);
        }
        try {
            const needsRefresh = await service.needsRefresh(profileId);
            let concepts;
            if (!needsRefresh) {
                console.info(`[shelf-concepts] pool is fresh for profile ${profileId}, skipping LLM call`);
                concepts = await service.getActivePool(profileId);
            }
            else {
                concepts = await service.generateConcepts(profileId, { count });
            }
            const profileContext = await service.buildProfileContext(profileId);
            return reply.send({
                concepts,
                coldStart: profileContext.coldStart,
                profileContext,
            });
        }
        catch (err) {
            return handleError(err, reply);
        }
    });
    app.get('/shelf-concepts', async (request, reply) => {
        const { profileId } = request.query ?? {};
        if (!profileId || typeof profileId !== 'string') {
            return reply.status(400).send({ error: 'profileId query param is required' });
        }
        const engineResult = await RecommendationEngineClient.getShelfConcepts(profileId);
        if (engineResult) {
            return reply.send(engineResult);
        }
        try {
            const concepts = await service.getActivePool(profileId);
            return reply.send(concepts);
        }
        catch (err) {
            return handleError(err, reply);
        }
    });
    app.post('/shelf-concepts/:id/feedback', async (request, reply) => {
        const { id } = request.params;
        const { signal } = request.body ?? {};
        if (signal !== 'good' && signal !== 'bad') {
            return reply.status(400).send({ error: "signal must be 'good' or 'bad'" });
        }
        try {
            await service.applyFeedback(id, signal);
            return reply.status(204).send();
        }
        catch (err) {
            return handleError(err, reply);
        }
    });
}
//# sourceMappingURL=shelf-concepts.js.map