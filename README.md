# coverage-data

Datastore branch for the **Devin Coverage Dashboard** ("git as the database").

This is an orphan branch written **only** by `.github/workflows/coverage-pipeline.yml`.
Do not merge it into `main` and do not edit it by hand.

```
data/
  manifest.json          # index of all snapshots + pulls, timestamp-ascending
  categories.json        # read-time category globs (compliance-critical, etc.)
  snapshots/<sha>.json    # one immutable coverage snapshot per merge/daily run
  pulls/<number>.json     # enriched PR metadata (reviews, session URL, …)
```

The static dashboard reads these files at runtime from
`https://raw.githubusercontent.com/kellyneil098/bank-of-devin/coverage-data/`.
