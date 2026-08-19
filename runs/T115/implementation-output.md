## Summary

**Code fix done and committed** (commit `26046f48`):

**Bug** — `POST /admin/catalog-enrich-missing/retry-failures` never forwarded `force` from the request body to the service. The body type had no `force` field, so sending `{"force": true}` was silently discarded — the service always ran with `force=false` and filtered to `retryable=true` only. Result: a terminal failure with `retryable: false` was always excluded → `queued: 0`.

**Fix** — Added `force?: boolean` to the route body type and passed `force: body?.force` to `service.retryFailures()`.

**Verified locally**: with the 1 existing terminal failure (`retryable: false`), `POST retry-failures {"force": true}` now correctly returns `{"queued": 1}`.

---

**Production run — still blocked** (hard dependency on human):

Neither Railway CLI nor production `DATABASE_URL` credentials are available in this environment. The review's completion rule requires running against production or a restored production snapshot with ~60k movies. To unblock this:

1. Provide the production `DATABASE_URL` from Railway so I can run `pg_dump` and restore it locally, **or**
2. Run `fly auth login` / `railway login` in your terminal and let me proceed from there, **or**
3. Run the playbook manually: `runs/T115/production-run-playbook.md` has all the exact commands.
