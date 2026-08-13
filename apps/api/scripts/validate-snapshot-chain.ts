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
) as { entries: Array<{ idx: number; tag: string; when: number }> };

const journalIdxs = new Set(journal.entries.map((e) => e.idx));

// Journal `when` must be strictly increasing with idx — drizzle-kit migrate
// uses a high-water mark on these timestamps and will skip/reorder otherwise.
const byIdx = [...journal.entries].sort((a, b) => a.idx - b.idx);
for (let i = 1; i < byIdx.length; i++) {
  if (!(byIdx[i - 1].when < byIdx[i].when)) {
    fail(
      `Journal when not monotonic at idx ${byIdx[i].idx} (${byIdx[i].tag}): ` +
        `${byIdx[i - 1].when} >= ${byIdx[i].when}`,
    );
  }
}

const snapshotFiles = readdirSync(metaDir)
  .filter((f) => /^\d{4}_snapshot\.json$/.test(f))
  .sort();

// Hand-written SQL migrations may omit snapshots; warn only.
for (const entry of journal.entries) {
  const expected = `${String(entry.idx).padStart(4, "0")}_snapshot.json`;
  if (!snapshotFiles.includes(expected)) {
    console.warn(
      `WARN: No snapshot for journal entry ${entry.idx} (${entry.tag}) — OK for hand-written SQL`,
    );
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
