import { pgClient } from '../../db/client.js'
import type { StageResult, CandidateItem, PipelineContext } from '../types.js'

export async function runSemanticSearch(
  ctx: PipelineContext,
  inputCandidates: CandidateItem[],
): Promise<StageResult> {
  const start = Date.now()

  try {
    const rows = await pgClient<{ count: string }[]>`SELECT COUNT(*) AS count FROM media_embeddings`
    const count = Number(rows[0]?.count ?? 0)

    if (count === 0) {
      return {
        stage: 'semantic-search',
        available: false,
        reason: 'no embeddings indexed',
        durationMs: Date.now() - start,
        inputCount: inputCandidates.length,
        outputCount: 0,
      }
    }

    // pgvector cosine search not yet implemented
    return {
      stage: 'semantic-search',
      available: false,
      reason: 'semantic search not yet implemented (embeddings exist but vector query not wired)',
      durationMs: Date.now() - start,
      inputCount: inputCandidates.length,
      outputCount: 0,
    }
  } catch {
    return {
      stage: 'semantic-search',
      available: false,
      reason: 'no embeddings indexed',
      durationMs: Date.now() - start,
      inputCount: inputCandidates.length,
      outputCount: 0,
    }
  }
}
