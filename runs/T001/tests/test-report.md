---

## Test Report — T001

**Verdict: PASS** (7/7 verifiable criteria, 1 not verifiable due to environment)

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Root install (`pnpm install`) | **PASS** |
| 2 | API + web can start locally | **PASS** |
| 3 | `GET /health` → `{"status":"ok"}` | **PASS** |
| 4 | Web shell renders + proxies to API | **PASS** |
| 5 | Android TV skeleton builds | **NOT VERIFIED** — JDK not installed |
| 6 | `pnpm lint` / `typecheck` / `test` | **PASS** |
| 7 | No `.env` secrets committed | **PASS** |
| 8 | README documents structure & startup | **PASS** |

**No blocking issues. No regressions.**

### Notes on AC5 (Android TV build)
The build cannot be executed because no JDK is installed on this machine. However, the project structure is complete and correct: valid `AndroidManifest.xml` with `LEANBACK_LAUNCHER`, Kotlin `MainActivity`, `build.gradle.kts` targeting SDK 34, Gradle wrapper present, Compose for TV and Media3 stubs commented-out ready to enable. This is an environment gap, not a code defect.

Report saved to `runs/T001/tests/test-report.md`.
