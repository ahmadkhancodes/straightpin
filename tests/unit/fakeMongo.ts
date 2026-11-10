import { ObjectId } from "mongodb";

// Minimal in-memory stand-in for the MongoDB driver surface Better Auth's mongodbAdapter and the kit's Mongo Db use
// (insertOne, findOne, find, aggregate with $match/$sort/$skip/$limit/$project, findOneAndUpdate/Delete, update*, delete*, createIndex).
type Doc = Record<string, any>;

const eq = (a: unknown, b: unknown) => {
  if (a instanceof ObjectId || b instanceof ObjectId) return String(a) === String(b);
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
};
const cmp = (a: any, b: any) => (a instanceof Date ? a.getTime() : a) - (b instanceof Date ? b.getTime() : b);

function matchValue(v: any, cond: any): boolean {
  if (cond && typeof cond === "object" && !(cond instanceof ObjectId) && !(cond instanceof Date) && !Array.isArray(cond)) {
    return Object.entries(cond).every(([op, x]: [string, any]) => {
      switch (op) {
        case "$eq": return eq(v, x);
        case "$ne": return !eq(v, x);
        case "$in": return (x as unknown[]).some((y) => eq(v, y));
        case "$nin": return !(x as unknown[]).some((y) => eq(v, y));
        case "$gt": return v != null && cmp(v, x) > 0;
        case "$gte": return v != null && cmp(v, x) >= 0;
        case "$lt": return v != null && cmp(v, x) < 0;
        case "$lte": return v != null && cmp(v, x) <= 0;
        case "$exists": return (v !== undefined) === !!x;
        case "$type": return typeof v === x;
        case "$regex": return typeof v === "string" && new RegExp(x, cond.$options ?? "").test(v);
        case "$options": return true;
        case "$not": return !matchValue(v, x);
        default: throw new Error(`fakeMongo: unsupported operator ${op}`);
      }
    });
  }
  return eq(v, cond);
}

export function matches(doc: Doc, filter: Doc = {}): boolean {
  return Object.entries(filter).every(([k, c]) => {
    if (k === "$and") return (c as Doc[]).every((f) => matches(doc, f));
    if (k === "$or") return (c as Doc[]).some((f) => matches(doc, f));
    if (k === "$nor") return !(c as Doc[]).some((f) => matches(doc, f));
    if (k === "$expr") return JSON.stringify(c) !== JSON.stringify({ $eq: [1, 0] });
    return matchValue(doc[k], c);
  });
}

/** Deep copy that keeps ObjectId and Date instances (structuredClone turns ObjectId into a plain object). */
function clone<T>(v: T): T {
  if (v === null || typeof v !== "object" || v instanceof ObjectId || v instanceof Date) return v;
  if (Array.isArray(v)) return v.map(clone) as T;
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) as T;
}

function applyUpdate(doc: Doc, u: Doc) {
  for (const [k, v] of Object.entries(u.$set ?? {})) doc[k] = v;
  for (const [k, v] of Object.entries(u.$inc ?? {})) doc[k] = (doc[k] ?? 0) + (v as number);
  for (const k of Object.keys(u.$unset ?? {})) delete doc[k];
}

export function fakeMongoClient() {
  const data = new Map<string, Doc[]>();
  const rows = (n: string) => (data.has(n) ? data.get(n)! : (data.set(n, []), data.get(n)!));
  const collection = (name: string) => {
    const all = () => rows(name);
    const findIdx = (f: Doc) => all().findIndex((d) => matches(d, f));
    return {
      async createIndex() { return "idx"; },
      async insertOne(d: Doc) {
        const doc = { _id: d._id ?? new ObjectId(), ...d };
        if (all().some((x) => eq(x._id, doc._id))) throw Object.assign(new Error("E11000 duplicate key"), { code: 11000 });
        all().push(doc);
        return { insertedId: doc._id, acknowledged: true };
      },
      async findOne(f: Doc = {}) { return clone(all().find((d) => matches(d, f)) ?? null); },
      find(f: Doc = {}) {
        let out = all().filter((d) => matches(d, f));
        const cur = {
          sort(s: Doc) { const [[k, dir]] = Object.entries(s); out = [...out].sort((a, b) => (a[k] > b[k] ? 1 : -1) * (dir as number)); return cur; },
          skip(n: number) { out = out.slice(n); return cur; },
          limit(n: number) { out = out.slice(0, n); return cur; },
          project() { return cur; },
          async toArray() { return clone(out); },
        };
        return cur;
      },
      aggregate(pipeline: Doc[]) {
        return {
          async toArray() {
            let out = all().map((d) => clone(d));
            for (const st of pipeline) {
              if (st.$match) out = out.filter((d) => matches(d, st.$match));
              else if (st.$limit) out = out.slice(0, st.$limit);
              else if (st.$skip) out = out.slice(st.$skip);
              else if (st.$sort) { const [[k, dir]] = Object.entries(st.$sort); out.sort((a, b) => (a[k] > b[k] ? 1 : -1) * (dir as number)); }
              else if (st.$count) out = [{ [st.$count]: out.length }];
              else if (st.$group) out = [{ _id: null, total: out.length }];
              else if (st.$project) continue;
              else throw new Error(`fakeMongo: unsupported stage ${Object.keys(st)[0]}`);
            }
            return out;
          },
        };
      },
      async findOneAndUpdate(f: Doc, u: Doc, o: Doc = {}) {
        let i = findIdx(f);
        if (i < 0 && o.upsert) { all().push({ _id: f._id ?? new ObjectId(), ...Object.fromEntries(Object.entries(f).filter(([k, v]) => !k.startsWith("$") && (typeof v !== "object" || v === null))) }); i = all().length - 1; }
        if (i < 0) return o.includeResultMetadata ? { value: null } : null;
        const before = clone(all()[i]);
        applyUpdate(all()[i], u);
        const value = clone(o.returnDocument === "after" ? all()[i] : before);
        return o.includeResultMetadata ? { value } : value;
      },
      async findOneAndDelete(f: Doc, o: Doc = {}) {
        const i = findIdx(f);
        const value = i < 0 ? null : all().splice(i, 1)[0];
        return o.includeResultMetadata ? { value } : value;
      },
      async updateOne(f: Doc, u: Doc, o: Doc = {}) {
        const i = findIdx(f);
        if (i < 0) {
          if (!o.upsert) return { matchedCount: 0, modifiedCount: 0 };
          const doc: Doc = { _id: f._id ?? new ObjectId() };
          applyUpdate(doc, { $set: { ...u.$setOnInsert, ...u.$set }, $inc: u.$inc });
          all().push(doc);
          return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
        }
        applyUpdate(all()[i], u);
        return { matchedCount: 1, modifiedCount: 1 };
      },
      async updateMany(f: Doc, u: Doc) {
        const hit = all().filter((d) => matches(d, f));
        hit.forEach((d) => applyUpdate(d, u));
        return { modifiedCount: hit.length };
      },
      async deleteOne(f: Doc) { const i = findIdx(f); if (i >= 0) all().splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 }; },
      async deleteMany(f: Doc) { const keep = all().filter((d) => !matches(d, f)); const n = all().length - keep.length; data.set(name, keep); return { deletedCount: n }; },
      async countDocuments(f: Doc = {}) { return all().filter((d) => matches(d, f)).length; },
    };
  };
  const db = { collection };
  return { data, db: () => db, startSession: () => { throw new Error("fakeMongo: no transactions"); }, close: async () => undefined };
}
