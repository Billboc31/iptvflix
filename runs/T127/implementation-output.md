All 19 tests pass. The test #7 log now clearly shows the corrected scenario: "Parasite" wins with `lang: 0.10` (foreign, low language affinity) and `heroScore: 0.804`, beating "Domestic Film" at `lang: 0.90` but `heroScore: 0.6325`.

Test #7 fixture corrected. "Parasite" now has `languageAffinity: 0.10` (correctly modelling a foreign-language film) and wins via strong `profileScore: 0.92` and `qualityPrior: 0.90`, proving there is no language hard-filter. All 19 hero-selector tests pass.
