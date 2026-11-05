import type { Fetcher, FetchRequest, FetchResult } from '../../types';

export interface FakeReply { status?: number; body?: string; headers?: Record<string, string> }

/** Fake Fetcher keyed by exact URL; records requests. Never touches the network. */
export function fakeFetcher(replies: Record<string, FakeReply>): Fetcher & { calls: FetchRequest[] } {
  const calls: FetchRequest[] = [];
  return {
    calls,
    async fetch(req: FetchRequest): Promise<FetchResult> {
      calls.push(req);
      const r = replies[req.url];
      if (!r) return { status: 404, body: '', headers: {}, notModified: false };
      const status = r.status ?? 200;
      const notModified = status === 304 || (!!req.etag && r.headers?.etag === req.etag && status === 200 && r.body === undefined);
      return { status: notModified ? 304 : status, body: r.body ?? '', headers: r.headers ?? {}, notModified };
    },
  };
}
