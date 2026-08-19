Committed. 43/43 tests pass, all packages typecheck clean. The implementation is complete:

- **`ProfileTaste`** extended with `dislikedMediaIds` / `notInterestedMediaIds` (split from `negativeMediaIds`)
- **`CompactTasteContext`** extended with `topKeywords`, `topFranchises`, `topLanguages`, `topDecades`, `mediaTypePreference` — fed into the LLM planner
- **`ScoreBreakdown`** extended with 5 new affinity dimensions
- **Hybrid reranker** rewritten as `SCORE_MODEL_V2` with 12 scoring dimensions and tiered negative-feedback penalties (DISLIKE=−2.0, NOT_INTERESTED=−1.2, abandon=−0.1)
- **DB migration** `0045_t114_profile_taste_disliked_not_interested.sql` added
- **43 tests** (37 unit + 6 integration) covering all new affinity functions and profile-divergence scenarios
