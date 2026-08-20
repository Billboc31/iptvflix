/**
 * Embedding benchmark suite — run with:
 *   pnpm --filter api benchmark:embeddings
 *
 * Requires DATABASE_URL and OPENAI_API_KEY env vars.
 */
import 'dotenv/config';
import { db } from '../db/client.js';
import { EmbeddingService } from '../services/embedding-service.js';
import { SemanticRetrievalService } from '../services/semantic-retrieval-service.js';
import { createDefaultProvider } from '../services/embedding-provider.js';
import { OPENAI_API_KEY } from '../config/env.js';
const BENCHMARKS = [
    {
        query: 'SF qui fait réfléchir',
        expectedTopTitles: ['Arrival', 'Interstellar', 'Blade Runner 2049', 'Ex Machina', 'Contact', '2001: A Space Odyssey'],
    },
    {
        query: 'thriller en huis clos où personne n\'est fiable',
        expectedTopTitles: ['Knives Out', 'The Hateful Eight', 'Clue', 'Identity', 'Coherence'],
    },
    {
        query: 'anime à binge-watcher',
        expectedTopTitles: ['Attack on Titan', 'Death Note', 'Fullmetal Alchemist', 'Demon Slayer', 'Jujutsu Kaisen'],
    },
    {
        query: 'comédie légère familiale',
        expectedTopTitles: ['Home Alone', 'Mrs. Doubtfire', 'The Princess Bride', 'Paddington', 'Paddington 2'],
    },
    {
        query: 'film sombre sur l\'intelligence artificielle',
        expectedTopTitles: ['Ex Machina', 'Blade Runner', 'Blade Runner 2049', 'A.I. Artificial Intelligence', 'Her', 'I, Robot'],
    },
];
function precisionAtK(results, expected, k) {
    const topK = results.slice(0, k);
    const normalise = (s) => s.toLowerCase().trim();
    const hits = topK.filter((r) => expected.some((e) => normalise(r).includes(normalise(e)) || normalise(e).includes(normalise(r))));
    return hits.length / k;
}
async function main() {
    if (!OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY is not set — cannot run benchmark');
        process.exit(1);
    }
    const provider = createDefaultProvider(OPENAI_API_KEY);
    const embeddingService = new EmbeddingService(db, provider);
    const retrievalService = new SemanticRetrievalService(db, embeddingService);
    console.log('=== IPTVFlix Embedding Benchmark Suite ===');
    console.log(`Model: ${provider.modelProvider}/${provider.modelName}\n`);
    const scores = [];
    for (const bench of BENCHMARKS) {
        console.log(`--- Query: "${bench.query}" ---`);
        const results = await retrievalService.retrieve(bench.query, 10);
        if (results.length === 0) {
            console.log('  No results — run the embedding backfill first.\n');
            scores.push({ p5: 0, p10: 0 });
            continue;
        }
        const titles = results.map((r) => r.title);
        const p5 = precisionAtK(titles, bench.expectedTopTitles, 5);
        const p10 = precisionAtK(titles, bench.expectedTopTitles, 10);
        results.forEach((r, i) => {
            const hit = bench.expectedTopTitles.some((e) => {
                const normalise = (s) => s.toLowerCase().trim();
                return normalise(r.title).includes(normalise(e)) || normalise(e).includes(normalise(r.title));
            });
            const marker = hit ? '[HIT]' : '     ';
            console.log(`  ${marker} ${i + 1}. ${r.title} (${r.mediaType}, ${r.year ?? '?'}) — similarity ${(r.similarity * 100).toFixed(1)}%`);
        });
        console.log(`  Precision@5: ${(p5 * 100).toFixed(0)}%  |  Precision@10: ${(p10 * 100).toFixed(0)}%`);
        console.log();
        scores.push({ p5, p10 });
    }
    const avgP5 = scores.reduce((s, c) => s + c.p5, 0) / scores.length;
    const avgP10 = scores.reduce((s, c) => s + c.p10, 0) / scores.length;
    const passCount = scores.filter((s) => s.p5 >= 0.2).length;
    console.log('=== Summary ===');
    console.log(`Avg Precision@5: ${(avgP5 * 100).toFixed(1)}%`);
    console.log(`Avg Precision@10: ${(avgP10 * 100).toFixed(1)}%`);
    console.log(`Benchmark pass rate (P@5 >= 20%): ${passCount}/${scores.length}`);
    process.exit(0);
}
main().catch((err) => {
    console.error('Benchmark failed:', err);
    process.exit(1);
});
//# sourceMappingURL=embedding-benchmarks.js.map