import { evaluate, GATE_MIN_SAMPLES, passesGate, trainLogReg, type Metrics, type Sample } from "../../../ml/agency/train";
import type { Db, LabelDoc } from "@/lib/db/types";
import type { JobDoc } from "@/lib/jobs/types";
import type { ClassifyInput } from "./types";

/** What the classifier sees for a job: the same fields at ingest time (company, apply host, title, excerpt). */
export function inputFromJob(j: Pick<JobDoc, "title" | "employerName" | "sourceHost" | "excerpt" | "country">): ClassifyInput {
  return { title: j.title, company: j.employerName, applyHost: j.sourceHost, excerpt: j.excerpt, country: j.country };
}

/**
 * Reviewer verdict on one job: writes the label (feeds training) and settles the job's flag.
 * `agency` = confirmed agency (hidden), `direct` = rejected (shown with the Direct tag). Score pins to 1 / 0.
 */
export async function reviewJob(db: Db, job: JobDoc, label: LabelDoc["label"], by: string, now = new Date()): Promise<LabelDoc> {
  const doc: LabelDoc = { jobId: job.id, label, input: inputFromJob(job), by, at: now };
  await db.addLabel(doc);
  await db.setJobAgency(job.id, label === "agency" ? "yes" : "no", label === "agency" ? 1 : 0);
  return doc;
}

export const labelsToSamples = (labels: LabelDoc[]): Sample[] => labels.map((l) => ({ input: l.input, label: l.label }));

export interface GateReport {
  labelled: number;
  agency: number;
  direct: number;
  needed: number;
  /** Null until there are enough labels to train and hold out a test set. */
  metrics: Metrics | null;
  passes: boolean;
}

/**
 * The precision gate over reviewer labels: deterministic 80/20 split (every 5th label held out), train on the
 * rest, evaluate on the held out part. The model stays off (`passes` false) until it clears the gate.
 */
export function labelGate(labels: LabelDoc[]): GateReport {
  const samples = labelsToSamples([...labels].sort((a, b) => a.jobId.localeCompare(b.jobId)));
  const agency = samples.filter((s) => s.label === "agency").length;
  const base = { labelled: samples.length, agency, direct: samples.length - agency, needed: GATE_MIN_SAMPLES };
  if (samples.length < GATE_MIN_SAMPLES || agency === 0 || agency === samples.length) return { ...base, metrics: null, passes: false };
  const test = samples.filter((_, i) => i % 5 === 4);
  const train = samples.filter((_, i) => i % 5 !== 4);
  const metrics = evaluate(trainLogReg(train), test);
  return { ...base, metrics, passes: passesGate(metrics) };
}
