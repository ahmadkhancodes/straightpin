import { DIM } from './features';
import type { AgencyModel, FeatureVector } from './types';

export interface ModelJson {
  version: string;
  dim: number;
  bias: number;
  /** Sparse: hashed index (string) -> weight. */
  weights: Record<string, number>;
  /** Sparse: hashed index (string) -> idf. */
  idf?: Record<string, number>;
}

function toMap(rec: Record<string, number>, dim: number, what: string): Map<number, number> {
  const m = new Map<number, number>();
  for (const [k, v] of Object.entries(rec)) {
    const i = Number(k);
    if (!Number.isInteger(i) || i < 0 || i >= dim) throw new Error(`model ${what}: bad index ${k}`);
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`model ${what}: bad value at ${k}`);
    m.set(i, v);
  }
  return m;
}

export function sigmoid(z: number): number {
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

export class LogisticModel implements AgencyModel {
  readonly version: string;
  readonly dim: number;
  readonly bias: number;
  readonly idf?: ReadonlyMap<number, number>;
  private readonly w: Map<number, number>;

  constructor(json: ModelJson) {
    if (json.dim !== DIM) throw new Error(`model dim ${json.dim} != ${DIM}`);
    if (typeof json.bias !== 'number' || !Number.isFinite(json.bias)) throw new Error('model bias invalid');
    this.version = json.version;
    this.dim = json.dim;
    this.bias = json.bias;
    this.w = toMap(json.weights, json.dim, 'weights');
    if (json.idf) this.idf = toMap(json.idf, json.dim, 'idf');
  }

  predict(features: FeatureVector): number {
    let z = this.bias;
    for (const [i, x] of features) {
      const w = this.w.get(i);
      if (w !== undefined) z += w * x;
    }
    return sigmoid(z);
  }

  toJSON(): ModelJson {
    const weights: Record<string, number> = {};
    for (const [i, w] of [...this.w].sort((a, b) => a[0] - b[0])) weights[String(i)] = w;
    const out: ModelJson = { version: this.version, dim: this.dim, bias: this.bias, weights };
    if (this.idf) {
      const idf: Record<string, number> = {};
      for (const [i, v] of [...this.idf].sort((a, b) => a[0] - b[0])) idf[String(i)] = v;
      out.idf = idf;
    }
    return out;
  }
}

export function loadModel(json: string | ModelJson): LogisticModel {
  const parsed: ModelJson = typeof json === 'string' ? (JSON.parse(json) as ModelJson) : json;
  if (!parsed || typeof parsed !== 'object' || typeof parsed.weights !== 'object' || parsed.weights === null) {
    throw new Error('model json: missing weights');
  }
  return new LogisticModel(parsed);
}
