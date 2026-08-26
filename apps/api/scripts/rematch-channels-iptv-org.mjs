/**
 * Rematch duplicate channels (same normalized_name) + enrich with iptv-org.
 *
 * 1) Merge rows sharing normalized_name into one survivor (keep oldest with most sources)
 * 2) Match remaining channels to iptv-org → iptv_org_id, country, logo, canonical name
 *
 * From apps/api/:
 *   DATABASE_URL=<url> node scripts/rematch-channels-iptv-org.mjs
 */
import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const CHANNELS_URL = 'https://iptv-org.github.io/api/channels.json'
const LOGOS_URL = 'https://iptv-org.github.io/api/logos.json'
const XMLTVFR_CHANNELS_URL = 'https://xmltvfr.fr/channels.php?guide=france'
const BATCH = 200

const QUALITY_TOKEN_RE =
  /\b(?:FHD|UHD|4K|HD|SD|HEVC|H\.?265|H\.?264|AVC|RAW|VIP|720p|1080p|2160p|480p|360p)\b/gi
const QUALITY_PAREN_RE = /\(\s*(?:FHD|UHD|4K|HD|SD|HEVC|H\.?265|RAW|VIP)\s*\)/gi
const IPTV_PREFIX_TOKEN_RE =
  /^(?:4K|UHD|HD|SD|FHD|VF|VO|VOSTFR|VOST|VFF|VOFF|MULTI|MULTi|ENG|FR|EN|UK|US|TRUEFRENCH|FRENCH|CAM|TS|HDR|DV|HEVC|H265|RAW|VIP|\d{3,4}P)$/i

const PREFIX_COUNTRY = {
  fr: 'FR', france: 'FR', be: 'BE', bel: 'BE', ch: 'CH', uk: 'GB', gb: 'GB',
  us: 'US', usa: 'US', ca: 'CA', de: 'DE', it: 'IT', es: 'ES', pt: 'PT',
  nl: 'NL', ar: 'SA', tr: 'TR', pl: 'PL', ru: 'RU',
}

const LANG_TO_COUNTRY = {
  fr: 'FR', en: 'GB', ar: 'SA', it: 'IT', es: 'ES', de: 'DE', nl: 'NL',
  pt: 'PT', tr: 'TR', pl: 'PL', ru: 'RU', el: 'GR', hi: 'IN', zh: 'CN',
}

function stripIptvPrefixes(input) {
  let working = input
  for (let i = 0; i < 3; i++) {
    const bracket = /^(?:\[[^\]]*\])\s*[-–—|:]\s+/.exec(working)
    if (bracket) { working = working.slice(bracket[0].length); continue }
    const bareBracket = /^(?:\[[^\]]*\])\s+/.exec(working)
    if (bareBracket) { working = working.slice(bareBracket[0].length); continue }
    const coded = /^([A-Za-z0-9+]{1,12}(?:-[A-Za-z0-9+]{1,12}){0,3})\s*[-–—|:]\s+/.exec(working)
    if (!coded) break
    const parts = coded[1].split('-')
    if (!parts.every((p) => IPTV_PREFIX_TOKEN_RE.test(p))) break
    working = working.slice(coded[0].length)
  }
  return working
}

function normalizeChannelName(raw) {
  let working = String(raw || '').replace(/_/g, ' ')
  working = stripIptvPrefixes(working)
  working = working.replace(QUALITY_PAREN_RE, ' ')
  working = working.replace(QUALITY_TOKEN_RE, ' ')
  return working.replace(/\s+/g, ' ').trim().toLowerCase()
}

function extractPrefixToken(text) {
  const trimmed = String(text || '').trim()
  const pipe = trimmed.match(/^([A-Za-z]{2,6})\s*[|:\-–—]\s*/)
  if (pipe) return pipe[1].toLowerCase()
  const bracket = trimmed.match(/^\[([A-Za-z]{2,6})\]\s*/)
  if (bracket) return bracket[1].toLowerCase()
  return null
}

function inferCountry(providerName, groupTitle, language) {
  for (const text of [groupTitle, providerName]) {
    if (!text) continue
    const token = extractPrefixToken(text)
    if (token && PREFIX_COUNTRY[token]) return PREFIX_COUNTRY[token]
  }
  if (language && LANG_TO_COUNTRY[language]) return LANG_TO_COUNTRY[language]
  return null
}

function uniqueMatch(candidates) {
  const ids = new Set(candidates.map((c) => c.id))
  if (ids.size !== 1) return null
  return candidates[0] ?? null
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`)
  return res.json()
}

async function loadCatalog() {
  const [channels, logos] = await Promise.all([
    fetchJson(CHANNELS_URL),
    fetchJson(LOGOS_URL).catch(() => []),
  ])
  const logosByChannel = new Map()
  for (const logo of logos) {
    if (logo.in_use === false) continue
    if (!logosByChannel.has(logo.channel) && logo.url) logosByChannel.set(logo.channel, logo.url)
  }

  const byId = new Map()
  const byNormalizedName = new Map()
  const byCountryAndName = new Map()

  for (const raw of channels) {
    if (raw.closed || raw.is_nsfw) continue
    const ch = { ...raw, logoUrl: logosByChannel.get(raw.id) ?? null }
    byId.set(ch.id, ch)
    const names = [ch.name, ...(ch.alt_names ?? [])]
    for (const name of names) {
      const norm = normalizeChannelName(name)
      if (!norm) continue
      const arr = byNormalizedName.get(norm) ?? []
      arr.push(ch)
      byNormalizedName.set(norm, arr)

      const country = (ch.country || '').toUpperCase()
      if (!country) continue
      let cmap = byCountryAndName.get(country)
      if (!cmap) { cmap = new Map(); byCountryAndName.set(country, cmap) }
      const carr = cmap.get(norm) ?? []
      carr.push(ch)
      cmap.set(norm, carr)
    }
  }
  return { byId, byNormalizedName, byCountryAndName }
}

function parseXmltvFrChannelsPage(html) {
  const rows = []
  const rowRe =
    /<th\s+scope="row">\s*([A-Za-z0-9]+\.[a-z]{2,3})\s*<\/th>\s*<td>\s*([^<]*?)\s*<\/td>/gi
  let match
  while ((match = rowRe.exec(html)) !== null) {
    const id = match[1].trim()
    const name = match[2].trim().replace(/\s+/g, ' ')
    if (!id || !name || name === '/') continue
    rows.push({ id, name })
  }
  if (rows.length === 0) {
    const mdRe = /\|\s*([A-Za-z0-9]+\.[a-z]{2,3})\s*\|\s*([^|]+?)\s*\|/g
    while ((match = mdRe.exec(html)) !== null) {
      const id = match[1].trim()
      const name = match[2].trim().replace(/\s+/g, ' ')
      if (!id || name === '/' || name === '---') continue
      rows.push({ id, name })
    }
  }
  return rows
}

async function loadXmltvFrCatalog() {
  const res = await fetch(XMLTVFR_CHANNELS_URL, {
    headers: { accept: 'text/html', 'user-agent': 'iptvflix/1.0' },
  })
  if (!res.ok) throw new Error(`xmltvfr fetch failed ${res.status}`)
  const html = await res.text()
  const channels = parseXmltvFrChannelsPage(html)
  const byId = new Map()
  const byNormalizedName = new Map()
  for (const ch of channels) {
    byId.set(ch.id, ch)
    const norm = normalizeChannelName(ch.name)
    if (!norm) continue
    const arr = byNormalizedName.get(norm) ?? []
    arr.push(ch)
    byNormalizedName.set(norm, arr)
    const idNorm = normalizeChannelName(ch.id.replace(/\.[a-z]{2,3}$/i, ''))
    if (idNorm && idNorm !== norm) {
      const idArr = byNormalizedName.get(idNorm) ?? []
      if (!idArr.some((c) => c.id === ch.id)) {
        idArr.push(ch)
        byNormalizedName.set(idNorm, idArr)
      }
    }
  }
  return { byId, byNormalizedName }
}

function matchOrg(catalog, providerName, groupTitle, language, tvgId) {
  if (tvgId && catalog.byId?.get(tvgId)) return catalog.byId.get(tvgId)
  const norm = normalizeChannelName(providerName)
  if (!norm) return null
  const country = inferCountry(providerName, groupTitle, language)
  if (country) {
    const local = uniqueMatch(catalog.byCountryAndName.get(country)?.get(norm) ?? [])
    if (local) return local
  }
  return uniqueMatch(catalog.byNormalizedName.get(norm) ?? [])
}

function matchXmltv(xmltv, providerName, groupTitle, language, tvgId) {
  if (!xmltv) return null
  if (tvgId && xmltv.byId.get(tvgId)) {
    const hit = xmltv.byId.get(tvgId)
    return { id: hit.id, name: hit.name, country: 'FR', logoUrl: null }
  }
  const norm = normalizeChannelName(providerName)
  if (!norm) return null
  const country = inferCountry(providerName, groupTitle, language)
  let candidates = xmltv.byNormalizedName.get(norm) ?? []
  if (country === 'FR' || !country) {
    const frOnly = candidates.filter((c) => c.id.endsWith('.fr'))
    if (frOnly.length) candidates = frOnly
  }
  const hit = uniqueMatch(candidates)
  if (!hit) return null
  return { id: hit.id, name: hit.name, country: 'FR', logoUrl: null }
}

const forcePlain = /localhost|127\.0\.0\.1|railway\.internal|proxy\.rlwy\.net/i.test(url)
const sql = postgres(url, { max: 5, connect_timeout: 20, ssl: forcePlain ? false : undefined })

try {
  console.log('[rematch] ensuring iptv_org_id column…')
  await sql`ALTER TABLE channels ADD COLUMN IF NOT EXISTS iptv_org_id text`
  await sql`CREATE INDEX IF NOT EXISTS channels_iptv_org_id_idx ON channels (iptv_org_id)`
  await sql`CREATE INDEX IF NOT EXISTS channels_normalized_name_idx ON channels (normalized_name)`

  console.log('[rematch] loading catalogs (iptv-org + xmltvfr)…')
  const [catalog, xmltv] = await Promise.all([
    loadCatalog(),
    loadXmltvFrCatalog().catch((err) => {
      console.warn('[rematch] xmltvfr unavailable:', err.message)
      return null
    }),
  ])
  console.log(`[rematch] xmltvfr channels: ${xmltv?.byId.size ?? 0}`)

  console.log('[rematch] re-normalizing names from provider titles…')
  const allRows = await sql`
    SELECT
      c.id,
      c.canonical_name,
      c.normalized_name,
      cs.provider_name
    FROM channels c
    LEFT JOIN LATERAL (
      SELECT provider_name
      FROM channel_sources
      WHERE channel_id = c.id
      ORDER BY priority DESC, last_seen_at DESC
      LIMIT 1
    ) cs ON true
  `
  const normUpdates = []
  for (const row of allRows) {
    const fresh = normalizeChannelName(row.provider_name || row.canonical_name)
    if (fresh && fresh !== row.normalized_name) {
      normUpdates.push({ id: row.id, normalized_name: fresh })
    }
  }
  for (let i = 0; i < normUpdates.length; i += BATCH) {
    const chunk = normUpdates.slice(i, i + BATCH)
    const ids = chunk.map((u) => u.id)
    const norms = chunk.map((u) => u.normalized_name)
    await sql`
      UPDATE channels AS c
      SET normalized_name = data.normalized_name, updated_at = now()
      FROM unnest(${ids}::uuid[], ${norms}::text[]) AS data(id, normalized_name)
      WHERE c.id = data.id
    `
  }
  console.log(`[rematch] re-normalized ${normUpdates.length} rows`)

  console.log('[rematch] merging duplicate normalized_name groups…')
  const dupGroups = await sql`
    SELECT normalized_name, array_agg(id ORDER BY created_at ASC) AS ids, count(*)::int AS n
    FROM channels
    WHERE normalized_name IS NOT NULL AND length(trim(normalized_name)) > 0
    GROUP BY normalized_name
    HAVING count(*) > 1
  `
  console.log(`[rematch] ${dupGroups.length} duplicate name groups`)

  const survivors = []
  const losers = []
  for (const g of dupGroups) {
    const ids = g.ids
    const survivor = ids[0]
    for (const loser of ids.slice(1)) {
      survivors.push(survivor)
      losers.push(loser)
    }
  }

  if (losers.length > 0) {
    console.log(`[rematch] reassigning ${losers.length} duplicate rows…`)
    // Drop favorite rows that would violate unique(profile, channel)
    await sql`
      DELETE FROM channel_favorites cf
      USING unnest(${losers}::uuid[], ${survivors}::uuid[]) AS m(loser, survivor)
      WHERE cf.channel_id = m.loser
        AND EXISTS (
          SELECT 1 FROM channel_favorites cf2
          WHERE cf2.profile_id = cf.profile_id AND cf2.channel_id = m.survivor
        )
    `
    await sql`
      UPDATE channel_favorites cf
      SET channel_id = m.survivor
      FROM unnest(${losers}::uuid[], ${survivors}::uuid[]) AS m(loser, survivor)
      WHERE cf.channel_id = m.loser
    `
    await sql`
      UPDATE channel_history ch
      SET channel_id = m.survivor
      FROM unnest(${losers}::uuid[], ${survivors}::uuid[]) AS m(loser, survivor)
      WHERE ch.channel_id = m.loser
    `
    await sql`
      UPDATE channel_sources cs
      SET channel_id = m.survivor
      FROM unnest(${losers}::uuid[], ${survivors}::uuid[]) AS m(loser, survivor)
      WHERE cs.channel_id = m.loser
    `
    await sql`DELETE FROM channels WHERE id = ANY(${losers}::uuid[])`
    console.log(`[rematch] merged away ${losers.length} duplicate channel rows`)
  } else {
    console.log('[rematch] no duplicates to merge')
  }

  console.log('[rematch] matching iptv-org + xmltvfr…')
  const rows = await sql`
    SELECT
      c.id,
      c.canonical_name,
      c.normalized_name,
      c.language,
      c.country,
      c.logo_url,
      c.iptv_org_id,
      cs.provider_name,
      cs.group_title,
      cs.tvg_id
    FROM channels c
    LEFT JOIN LATERAL (
      SELECT provider_name, group_title, tvg_id
      FROM channel_sources
      WHERE channel_id = c.id
      ORDER BY priority DESC, last_seen_at DESC
      LIMIT 1
    ) cs ON true
  `

  const updates = []
  let xmltvHits = 0
  for (const row of rows) {
    const name = row.provider_name || row.canonical_name
    // Re-normalize if historical names still have HD tokens
    const freshNorm = normalizeChannelName(name)
    const org =
      matchOrg(catalog, name, row.group_title, row.language, row.tvg_id) ||
      matchXmltv(xmltv, name, row.group_title, row.language, row.tvg_id)
    if (org && !catalog.byId?.get(org.id) && xmltv?.byId?.get(org.id)) xmltvHits++

    // Prefer IPTV feed country (FR|…) over registry country (beIN = QA).
    const feedCountry = inferCountry(name, row.group_title, row.language)
    const country = feedCountry ?? org?.country ?? row.country

    const next = {
      id: row.id,
      iptv_org_id: org?.id ?? row.iptv_org_id,
      country: country ?? null,
      logo_url: row.logo_url || org?.logoUrl || null,
      canonical_name: org?.name ?? row.canonical_name,
      normalized_name: freshNorm || row.normalized_name,
    }

    const changed =
      next.iptv_org_id !== row.iptv_org_id ||
      next.country !== row.country ||
      next.logo_url !== row.logo_url ||
      next.canonical_name !== row.canonical_name ||
      next.normalized_name !== row.normalized_name

    if (changed) updates.push(next)
  }

  console.log(`[rematch] ${updates.length} channels to enrich (xmltvfr matches in this pass: ${xmltvHits})`)

  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH)
    const ids = chunk.map((u) => u.id)
    const orgIds = chunk.map((u) => u.iptv_org_id)
    const countries = chunk.map((u) => u.country)
    const logos = chunk.map((u) => u.logo_url)
    const names = chunk.map((u) => u.canonical_name)
    const norms = chunk.map((u) => u.normalized_name)

    await sql`
      UPDATE channels AS c
      SET
        iptv_org_id = data.iptv_org_id,
        country = data.country,
        logo_url = COALESCE(c.logo_url, data.logo_url),
        canonical_name = data.canonical_name,
        normalized_name = data.normalized_name,
        updated_at = now()
      FROM unnest(
        ${ids}::uuid[],
        ${orgIds}::text[],
        ${countries}::text[],
        ${logos}::text[],
        ${names}::text[],
        ${norms}::text[]
      ) AS data(id, iptv_org_id, country, logo_url, canonical_name, normalized_name)
      WHERE c.id = data.id
    `
    console.log(`[rematch] wrote ${Math.min(i + BATCH, updates.length)}/${updates.length}`)
  }

  const curated = await sql`
    SELECT count(*)::int AS n FROM channels WHERE iptv_org_id IS NOT NULL AND country = 'FR'
  `
  const samples = await sql`
    SELECT canonical_name, iptv_org_id
    FROM channels
    WHERE iptv_org_id IN ('Ligue1Plus.fr', 'DAZN.fr', 'CanalPlusLigue1.fr', 'TF1.fr')
    ORDER BY iptv_org_id
    LIMIT 20
  `
  console.log(`[rematch] FR curated channels: ${curated[0].n}`)
  console.log('[rematch] sample sport/tnt ids:', samples.map((s) => `${s.iptv_org_id}=${s.canonical_name}`).join(' | ') || '(none)')
  console.log('[rematch] done')
} catch (err) {
  console.error('[rematch] failed:', err)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
