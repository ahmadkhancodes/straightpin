# Agency model training

Pure TypeScript logistic regression over hashed TF-IDF features (word 1-2 grams, char 3-5 grams, 2^16 dims).
No dataset is bundled. Inference lives in `src/lib/classify/` (rules first, then this model).

## Labelling format (JSONL)

One JSON object per line:

```json
{"input": {"title": "...", "company": "...", "companyDomain": "acme.com", "applyHost": "jobs.lever.co/acme", "excerpt": "...", "sicCode": "7363", "country": "US"}, "label": "agency"}
```

`label` is `"agency"` or `"direct"`. `input` is a `ClassifyInput` (see `src/lib/classify/types.ts`); only `title`, `company`, `excerpt` are required.
Labels come from the admin labelling tool (`AgencyLabel`). Target: 3K or more labels; keep a held out set that is never trained on.

## Functions (`train.ts`)

- `trainLogReg(samples, opts)`: SGD with L2, seeded shuffling (no `Math.random`), returns a `LogisticModel`.
- `evaluate(model, samples, threshold = 0.65)`: `{precision, recall, f1, n}` for the agency class.
- `passesGate(metrics)`: see below.
- `exportModel(model)`: JSON string for `loadModel()` (stored with a `ModelVersion` row: kind, precision, recall, file_sha, active).

## Activation gate (TRUST-01)

A model may go live only if, on a held out set of at least 300 labelled samples (target 500), precision >= 0.95 AND recall >= 0.85.
The roadmap milestone gate is a looser 93% on 300 samples; `passesGate` implements the stricter product gate.
Posts scoring 0.35 to 0.65 go to the admin review queue. If no model passes, ship rules only plus the review queue.
