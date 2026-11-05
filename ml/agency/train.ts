/**
 * Agency model training (plain TS module, no CLI). Deterministic: seeded PRNG, no Math.random.
 * Labelled sample format is documented in README.md.
 */
import { DIM, featurize } from '../../src/lib/classify/features';
import { loadModel, LogisticModel, sigmoid } from '../../src/lib/classify/model';
import type { ModelJson } from '../../src/lib/classify/model';
import { AGENCY_YES_THRESHOLD } from '../../src/lib/classify/types';
import type { ClassifyInput, FeatureVector } from '../../src/lib/classify/types';

export interface Sample {
  input: ClassifyInput;
  label: 'agency' | 'direct';
}

export interface TrainOpts {
  epochs?: number;
  learningRate?: number;
  l2?: number;
  seed?: number;
  version?: string;
}

export interface Metrics {
  precision: number;
  recall: number;
  f1: number;
  n: number;
}

export const GATE_MIN_PRECISION = 0.95;
export const GATE_MIN_RECALL = 0.85;
export const GATE_MIN_SAMPLES = 300;

/** mulberry32: small deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function trainLogReg(samples: Sample[], opts: TrainOpts = {}): LogisticModel {
  if (samples.length === 0) throw new Error('trainLogReg: no samples');
  const epochs = opts.epochs ?? 30;
  const lr = opts.learningRate ?? 0.5;
  const l2 = opts.l2 ?? 1e-4;
  const rand = mulberry32(opts.seed ?? 1);

  // Pass 1: document frequency over raw (idf free) features.
  const df = new Float64Array(DIM);
  for (const s of samples) for (const idx of featurize(s.input).keys()) df[idx] = (df[idx] ?? 0) + 1;
  const n = samples.length;
  const idf = new Map<number, number>();
  for (let i = 0; i < DIM; i++) {
    const d = df[i] ?? 0;
    if (d > 0) idf.set(i, Math.log((1 + n) / (1 + d)) + 1);
  }

  // Pass 2: tf-idf vectors.
  const xs: FeatureVector[] = samples.map((s) => featurize(s.input, idf));
  const ys = samples.map((s) => (s.label === 'agency' ? 1 : 0));

  const w = new Float64Array(DIM);
  let bias = 0;
  const order = samples.map((_, i) => i);
  for (let e = 0; e < epochs; e++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = order[i] as number;
      order[i] = order[j] as number;
      order[j] = t;
    }
    const rate = lr / (1 + 0.05 * e);
    for (const k of order) {
      const x = xs[k] as FeatureVector;
      let z = bias;
      for (const [idx, v] of x) z += (w[idx] ?? 0) * v;
      const g = sigmoid(z) - (ys[k] as number);
      bias -= rate * g;
      // L2 applied to touched weights only (lazy approximation, cheap and deterministic).
      for (const [idx, v] of x) w[idx] = (w[idx] ?? 0) - rate * (g * v + l2 * (w[idx] ?? 0));
    }
  }

  const weights: Record<string, number> = {};
  for (let i = 0; i < DIM; i++) {
    const v = w[i] ?? 0;
    if (Math.abs(v) > 1e-6) weights[String(i)] = v;
  }
  const idfJson: Record<string, number> = {};
  for (const [i, v] of idf) idfJson[String(i)] = v;
  const json: ModelJson = {
    version: opts.version ?? `logreg-seed${opts.seed ?? 1}-n${n}`,
    dim: DIM,
    bias,
    weights,
    idf: idfJson,
  };
  return loadModel(json);
}

/** Precision/recall/F1 for the "agency" class at `threshold` (default: the "yes" threshold 0.65). */
export function evaluate(
  model: { predict(f: FeatureVector): number; readonly idf?: ReadonlyMap<number, number> },
  samples: Sample[],
  threshold: number = AGENCY_YES_THRESHOLD,
): Metrics {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (const s of samples) {
    const predicted = model.predict(featurize(s.input, model.idf)) >= threshold;
    const actual = s.label === 'agency';
    if (predicted && actual) tp++;
    else if (predicted && !actual) fp++;
    else if (!predicted && actual) fn++;
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1, n: samples.length };
}

/** Activation gate: precision >= 0.95 AND recall >= 0.85 on a held out set of >= 300 samples. */
export function passesGate(metrics: Metrics): boolean {
  return (
    metrics.n >= GATE_MIN_SAMPLES &&
    metrics.precision >= GATE_MIN_PRECISION &&
    metrics.recall >= GATE_MIN_RECALL
  );
}

export function exportModel(model: LogisticModel): string {
  return JSON.stringify(model.toJSON());
}
