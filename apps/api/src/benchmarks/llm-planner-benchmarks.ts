/**
 * LLM Planner benchmark suite — run with:
 *   pnpm --filter api benchmark:planner
 *
 * Requires DATABASE_URL and OPENAI_API_KEY env vars.
 * Compares path A (raw query) vs path B (LLM-expanded semantic intent).
 */
import 'dotenv/config'
import { db } from '../db/client.js'
import { EmbeddingService } from '../services/embedding-service.js'
import { SemanticRetrievalService } from '../services/semantic-retrieval-service.js'
import { createDefaultProvider } from '../services/embedding-provider.js'
import { LlmQueryPlannerService } from '../services/llm-query-planner-service.js'
import { createOpenAiPlannerProvider } from '../services/openai-llm-planner-provider.js'
import { OPENAI_API_KEY, LLM_PLANNER_MODEL } from '../config/env.js'

interface BenchmarkCase {
  query: string
  expectedTopTitles: string[]
}

const BENCHMARKS: BenchmarkCase[] = [
  {
    query: 'SF qui fait réfléchir',
    expectedTopTitles: ['Arrival', 'Interstellar', 'Blade Runner 2049', 'Ex Machina', 'Contact', '2001: A Space Odyssey'],
  },
  {
    query: "thriller en huis clos où personne n'est fiable",
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
    query: "film sombre sur l'intelligence artificielle",
    expectedTopTitles: ['Ex Machina', 'Blade Runner', 'Blade Runner 2049', 'A.I. Artificial Intelligence', 'Her', 'I, Robot'],
  },
]

function precisionAtK(results: string[], expected: string[], k: number): number {
  const topK = results.slice(0, k)
  const normalise = (s: string) => s.toLowerCase().trim()
  const hits = topK.filter((r) =>
    expected.some((e) => normalise(r).includes(normalise(e)) || normalise(e).includes(normalise(r))),
  )
  return hits.length / k
}

async function main() {
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set — cannot run benchmark')
    process.exit(1)
  }

  const embeddingProvider = createDefaultProvider(OPENAI_API_KEY)
  const embeddingService = new EmbeddingService(db, embeddingProvider)
  const retrievalService = new SemanticRetrievalService(db, embeddingService)
  const plannerService = new LlmQueryPlannerService(
    createOpenAiPlannerProvider(OPENAI_API_KEY, LLM_PLANNER_MODEL),
  )

  console.log('=== IPTVFlix LLM Planner Benchmark Suite ===')
  console.log(`Embedding model: ${embeddingProvider.modelProvider}/${embeddingProvider.modelName}`)
  console.log(`LLM planner model: ${LLM_PLANNER_MODEL}\n`)

  const scores: { rawP5: number; rawP10: number; expandedP5: number; expandedP10: number }[] = []

  for (const bench of BENCHMARKS) {
    console.log(`--- Query: "${bench.query}" ---`)

    // Generate plan (path B)
    const plan = await plannerService.plan(bench.query, null)

    if (!plan.plannerFallback) {
      console.log(`  displayTitle:    ${plan.displayTitle}`)
      console.log(`  semanticIntent:  ${plan.semanticIntent.slice(0, 120)}…`)
      if (plan.desiredThemes.length) console.log(`  themes:          ${plan.desiredThemes.join(', ')}`)
      if (plan.desiredTone.length) console.log(`  tone:            ${plan.desiredTone.join(', ')}`)
      if (plan.avoidSignals.length) console.log(`  avoid:           ${plan.avoidSignals.join(', ')}`)
      if (plan.hardFilters.maxRuntimeMinutes) console.log(`  maxRuntime:      ${plan.hardFilters.maxRuntimeMinutes} min`)
      if (plan.userConstraints.length) console.log(`  userConstraints: ${plan.userConstraints.join(', ')}`)
      console.log(`  latencyMs:       ${plan.plannerMeta?.latencyMs ?? 'n/a'}`)
    } else {
      console.log('  [FALLBACK] Plan generation failed — using raw query for both paths')
    }

    // Path A: raw query
    const rawResults = await retrievalService.retrieve(bench.query, 10)
    // Path B: LLM-expanded semantic intent
    const expandedResults = await retrievalService.retrieve(bench.query, 10, plan.semanticIntent)

    if (rawResults.length === 0 && expandedResults.length === 0) {
      console.log('  No results — run the embedding backfill first.\n')
      scores.push({ rawP5: 0, rawP10: 0, expandedP5: 0, expandedP10: 0 })
      continue
    }

    const rawTitles = rawResults.map((r) => r.title)
    const expandedTitles = expandedResults.map((r) => r.title)

    const rawP5 = precisionAtK(rawTitles, bench.expectedTopTitles, 5)
    const rawP10 = precisionAtK(rawTitles, bench.expectedTopTitles, 10)
    const expandedP5 = precisionAtK(expandedTitles, bench.expectedTopTitles, 5)
    const expandedP10 = precisionAtK(expandedTitles, bench.expectedTopTitles, 10)

    console.log('\n  Path A (raw):')
    rawResults.forEach((r, i) => {
      const hit = bench.expectedTopTitles.some((e) => {
        const n = (s: string) => s.toLowerCase().trim()
        return n(r.title).includes(n(e)) || n(e).includes(n(r.title))
      })
      console.log(`    ${hit ? '[HIT]' : '     '} ${i + 1}. ${r.title} (${r.mediaType}, ${r.year ?? '?'}) — ${(r.similarity * 100).toFixed(1)}%`)
    })
    console.log(`  P@5: ${(rawP5 * 100).toFixed(0)}%  |  P@10: ${(rawP10 * 100).toFixed(0)}%`)

    console.log('\n  Path B (LLM-expanded):')
    expandedResults.forEach((r, i) => {
      const hit = bench.expectedTopTitles.some((e) => {
        const n = (s: string) => s.toLowerCase().trim()
        return n(r.title).includes(n(e)) || n(e).includes(n(r.title))
      })
      console.log(`    ${hit ? '[HIT]' : '     '} ${i + 1}. ${r.title} (${r.mediaType}, ${r.year ?? '?'}) — ${(r.similarity * 100).toFixed(1)}%`)
    })
    console.log(`  P@5: ${(expandedP5 * 100).toFixed(0)}%  |  P@10: ${(expandedP10 * 100).toFixed(0)}%`)

    const delta = expandedP5 - rawP5
    const verdict = delta > 0.05 ? 'BETTER' : delta < -0.05 ? 'WORSE' : 'SIMILAR'
    console.log(`  Delta P@5: ${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(0)}% → expansion is ${verdict}\n`)

    scores.push({ rawP5, rawP10, expandedP5, expandedP10 })
  }

  const avg = (key: keyof (typeof scores)[number]) =>
    scores.reduce((s, c) => s + c[key], 0) / scores.length

  console.log('=== Summary ===')
  console.log(`Avg P@5  — Raw: ${(avg('rawP5') * 100).toFixed(1)}%  |  LLM-expanded: ${(avg('expandedP5') * 100).toFixed(1)}%`)
  console.log(`Avg P@10 — Raw: ${(avg('rawP10') * 100).toFixed(1)}%  |  LLM-expanded: ${(avg('expandedP10') * 100).toFixed(1)}%`)

  process.exit(0)
}

main().catch((err) => {
  console.error('Benchmark failed:', err)
  process.exit(1)
})
