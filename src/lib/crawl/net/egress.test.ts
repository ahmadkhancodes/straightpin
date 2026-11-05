import { describe, expect, it } from 'vitest';
import { assertAllowedHost, EgressBlockedError } from './egress';

describe('assertAllowedHost', () => {
  it.each([
    'https://indeed.com/jobs', 'https://www.indeed.com/x', 'https://uk.indeed.com', 'https://linkedin.com/jobs/1',
    'https://www.linkedin.com/', 'https://glassdoor.com', 'https://api.glassdoor.com/x', 'https://directroles.net/', 'https://app.directroles.net:8443/a',
    'https://INDEED.COM./x',
  ])('blocks deny-listed %s', (u) => { expect(() => assertAllowedHost(u)).toThrow(EgressBlockedError); });

  it.each(['ftp://a.test/x', 'file:///etc/passwd', 'javascript:alert(1)', 'not a url'])('blocks %s', (u) => {
    expect(() => assertAllowedHost(u)).toThrow(EgressBlockedError);
  });

  it.each([
    'http://localhost/x', 'http://api.localhost/', 'http://127.0.0.1/', 'http://10.1.2.3/', 'http://172.16.0.1/', 'http://172.31.255.1/',
    'http://192.168.1.1/', 'http://169.254.169.254/latest', 'http://0.0.0.0/', 'http://[::1]/', 'http://[fd00::1]/', 'http://[fe80::1]/', 'http://[::ffff:127.0.0.1]/', 'http://printer.local/',
  ])('blocks private %s', (u) => { expect(() => assertAllowedHost(u)).toThrow(EgressBlockedError); });

  it.each([
    'https://boards-api.greenhouse.io/v1/boards/a/jobs', 'http://example.com', 'https://notindeed.com/', 'https://172.32.0.1/', 'https://8.8.8.8/',
  ])('allows %s', (u) => { expect(assertAllowedHost(u).href).toBeTruthy(); });
});
