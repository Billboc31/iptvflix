import type { ShelfConceptProfileContext } from '@iptvflix/api-contracts'

type Message = { role: 'system' | 'user'; content: string }

const SYSTEM_PROMPT = `You are an editorial concept generator for a video streaming service.
Your goal: produce a diverse set of shelf concepts that will be used to search the catalog via semantic embeddings.

A shelf concept is NOT a list of movies. It is an editorial label (like a magazine section) that describes
a thematic collection. A recommendation engine will embed the semanticIntent to find matching catalog items.

Output format:
Return ONLY a JSON object with a single "concepts" key whose value is an array.
Each concept object must have exactly these keys:
- title (string, max 60 chars): short, evocative display label. Prefer French if profile language is unknown.
- rawIntent (string): 1–2 sentences describing what items this shelf should contain.
- semanticIntent (string): 3–5 rich sentences for embedding search — include themes, tone, style, mood.
- generationType (string): one of "PERSONALIZED" | "EXPLORATION" | "DISCOVERY" | "FIXED" | "EDITORIAL"
- reasonCodes (string[]): brief codes explaining why this concept was chosen, e.g. ["top_genre:thriller", "binge_tendency", "adjacent_to_liked_director"]
- desiredMediaTypes (string[]): subset of ["MOVIE", "SERIES"] — use both if unspecified.
- freshnessPolicy (string | null): null | "AVAILABLE_NOW" | "NEW_RELEASES" | "ALL"

Variety rules:
- Mix across: thematic, directorial style, mood/tone, cultural origin, narrative structure.
- Avoid generating only genre-only shelves (e.g., "Films d'action" alone is weak).
- Good concept examples: "SF qui fait réfléchir", "Dans la lignée de Denis Villeneuve",
  "Thrillers en huis clos où personne n'est fiable", "Anime à binge-watcher",
  "Quand l'intelligence artificielle nous dépasse", "Nouveautés proches de vos goûts".
- DO NOT name or reference specific content titles or IDs from memory.
- DO NOT invent actors, directors, or creators not mentioned in the profile context.

Cold-start rules (when coldStart is true in context):
- Ignore personal taste fields (topGenres, likedPeople, recentlyWatched, etc.).
- Focus on: popular editorial concepts, genre-starter mixes, language-appropriate content.
- Use DISCOVERY or EDITORIAL generationType only.`

export function buildShelfConceptPrompt(
  context: ShelfConceptProfileContext,
  counts: { personalized: number; exploration: number; discovery: number },
): Message[] {
  const total = counts.personalized + counts.exploration + counts.discovery

  const safeContext = context.coldStart
    ? {
        coldStart: true,
        isKids: context.isKids,
        languagePreferences: context.languagePreferences,
        newCatalogSignals: context.newCatalogSignals,
      }
    : context

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Generate exactly ${total} shelf concepts with this distribution:
- ${counts.personalized} PERSONALIZED (tailored to profile taste signals)
- ${counts.exploration} EXPLORATION (adjacent to taste but new directions, broaden the horizon)
- ${counts.discovery} DISCOVERY (broad, popular, trending, or editorial — not taste-dependent)

Profile context:
${JSON.stringify(safeContext)}

Return only the JSON object with the "concepts" array. No explanation.`,
    },
  ]
}
