import { featurize } from './features';
import { sigmoid } from './model';
import { applyRules } from './rules';
import { flagForScore } from './types';
import type { AgencyModel, AgencyRules, ClassifyInput, ClassifyResult } from './types';

/** Score when no rule fires and there is no model: crawled employer boards default to direct. */
export const NO_SIGNAL_SCORE = 0.2;

function logit(p: number): number {
  const c = Math.min(0.999, Math.max(0.001, p));
  return Math.log(c / (1 - c));
}

export interface ClassifierOptions {
  rules: AgencyRules;
  model?: AgencyModel;
}

/**
 * Rules first: decisive hits win. Otherwise, with a model, the model logit is added to the
 * soft rule logit (phrases push up, direct signals push down). Without a model, rules only.
 */
export function createClassifier(opts: ClassifierOptions): (input: ClassifyInput) => ClassifyResult {
  const { rules, model } = opts;
  return function classify(input: ClassifyInput): ClassifyResult {
    const r = applyRules(input, rules);
    const reasons = [...r.hits];
    let score: number;
    if (r.decisive && r.score !== null) {
      score = r.score;
    } else if (model) {
      const m = model.predict(featurize(input, model.idf));
      reasons.push(`model: ${m.toFixed(3)}`);
      score = r.score === null ? m : sigmoid(logit(m) + logit(r.score));
    } else if (r.score !== null) {
      score = r.score;
    } else {
      score = NO_SIGNAL_SCORE;
      reasons.push('no agency signals');
    }
    score = Math.min(1, Math.max(0, score));
    return { score, flag: flagForScore(score), reasons };
  };
}

export function agencyReceipt(removed: number): string {
  return `We removed ${removed} staffing agency ${removed === 1 ? 'post' : 'posts'} from this list.`;
}
