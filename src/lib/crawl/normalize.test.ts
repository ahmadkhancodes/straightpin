import { describe, expect, it } from 'vitest';
import { detectCountry, detectRemoteType, normTitle, excerptOf } from './normalize';

describe('detectCountry', () => {
  it.each([
    ['San Francisco, CA', 'US'], ['Austin, TX', 'US'], ['Remote, United States', 'US'],
    ['Toronto, Ontario, Canada', 'CA'], ['Vancouver, BC', 'CA'], ['Ottawa, ON, Canada', 'CA'],
    ['Manchester, UK', 'UK'], ['London, England', 'UK'], ['Berlin, DE', null], ['Berlin, Germany', null],
  ])('%s => %s', (loc, want) => expect(detectCountry(loc as string)).toBe(want));
});
describe('helpers', () => {
  it('remote type', () => { expect(detectRemoteType('Remote, US')).toBe('remote'); expect(detectRemoteType('Hybrid London')).toBe('hybrid'); });
  it('title norm', () => expect(normTitle('Customer Support Specialist (Remote)')).toBe('customer support specialist'));
  it('excerpt cap', () => expect(excerptOf('a '.repeat(500)).length).toBeLessThanOrEqual(600));
});
