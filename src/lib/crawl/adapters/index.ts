import type { AtsAdapter, AtsKind } from '../types';
import { ashby } from './ashby';
import { greenhouse } from './greenhouse';
import { lever } from './lever';
import { personio } from './personio';
import { recruitee } from './recruitee';
import { workable } from './workable';

const registry: Partial<Record<AtsKind, AtsAdapter>> = { greenhouse, lever, ashby, workable, recruitee, personio };

/** Returns the adapter for an ATS, or null (smartrecruiters is off; jsonld lives in careers/). */
export function getAdapter(ats: AtsKind): AtsAdapter | null {
  return registry[ats] ?? null;
}
export { greenhouse, lever, ashby, workable, recruitee, personio };
export { RateLimitedError, AdapterHttpError } from './common';
export { UnsafeXmlError } from './xml';
