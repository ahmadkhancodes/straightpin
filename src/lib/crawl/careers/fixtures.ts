import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function fixture(name: string): string {
  return readFileSync(join(__dirname, '__fixtures__', name), 'utf8');
}
