import { readFileSync, readdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const metaDir = resolve(__dirname, "../migrations/meta");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

const journal = JSON.parse(
  readFileSync(join(metaDir, "_journal.json"), "utf-8")
) as { entries: Array<{ idx: number; tag: string }> };

const journalIdxs = new Set(journal.entries.map((e) => e.idx));

const snapshotFiles = readdirSync(metaDir)
  .filter((f) => /^\d{4}_snapshot\.json$/.test(f))
  .sort();

// Every journal entry must have a snapshot file
for (const entry of journal.entries) {
  const expected = `${String(entry.idx).padStart(4, "0")}_snapshot.json`;
  if (!snapshotFiles.includes(expected)) {
    fail(`Missing snapshot file for journal entry ${entry.idx} (${entry.tag}): expected ${expected}`);
  }
}

// Every snapshot file must have a matching journal entry
for (const file of snapshotFiles) {
  const idx = parseInt(file.slice(0, 4), 10);
  if (!journalIdxs.has(idx)) {
    fail(`Snapshot file ${file} has no matching journal entry (idx ${idx})`);
  }
}

const ids = new Set<string>();
let prevId: string | null = null;

for (const file of snapshotFiles) {
  const raw = JSON.parse(readFileSync(join(metaDir, file), "utf-8")) as {
    id: string;
    prevId: string;
  };
  const { id, prevId: pid } = raw;

  if (!UUID_RE.test(id)) {
    fail(`${file}: id is not a valid UUID ("${id}")`);
  }
  if (id === pid) {
    fail(`${file}: id === prevId (self-reference: "${id}")`);
  }
  if (ids.has(id)) {
    fail(`${file}: id "${id}" is duplicated across snapshots`);
  }

  if (prevId === null) {
    if (pid !== NIL_UUID) {
      fail(`${file}: first snapshot prevId must be nil UUID, got "${pid}"`);
    }
  } else {
    if (pid !== prevId) {
      fail(
        `${file}: prevId "${pid}" does not match preceding snapshot id "${prevId}"`
      );
    }
  }

  ids.add(id);
  prevId = id;
}

console.log(`OK: ${snapshotFiles.length} snapshots form a valid chain.`);
