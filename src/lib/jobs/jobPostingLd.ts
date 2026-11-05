import type { JobDoc } from "./types";

const COUNTRY = { US: "US", CA: "CA", UK: "GB" } as const;
const UNIT = { hour: "HOUR", day: "DAY", week: "WEEK", month: "MONTH", year: "YEAR" } as const;

/**
 * schema.org JobPosting for a job page. `url` is the employer's own apply page (we do not take applications),
 * the description is the short excerpt we keep, and the posted date is the company's own first published date
 * (never an updated date). Returns null for a closed job: a page that says "taken down" must not claim an open posting.
 */
export function jobPostingLd(job: JobDoc): Record<string, unknown> | null {
  if (job.closedAt) return null;
  const remote = job.remoteType === "remote";
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.excerpt || job.title,
    datePosted: (job.firstPublishedAt ?? job.firstSeenAt).toISOString().slice(0, 10),
    employmentType: job.schedule === "part" ? "PART_TIME" : "FULL_TIME",
    hiringOrganization: { "@type": "Organization", name: job.employerName },
    identifier: { "@type": "PropertyValue", name: job.employerName, value: job.externalId },
    url: job.applyUrl,
    directApply: false,
  };
  if (job.validThrough) ld.validThrough = job.validThrough.toISOString();
  if (remote) {
    ld.jobLocationType = "TELECOMMUTE";
    ld.applicantLocationRequirements = { "@type": "Country", name: COUNTRY[job.country] };
  }
  if (!remote || job.location) {
    ld.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(job.location ? { addressLocality: job.location } : {}),
        ...(job.region ? { addressRegion: job.region } : {}),
        addressCountry: COUNTRY[job.country],
      },
    };
  }
  const lo = job.payMin ?? job.payMax;
  const hi = job.payMax ?? job.payMin;
  if (lo !== null && hi !== null && job.payPeriod && job.currency) {
    ld.baseSalary = {
      "@type": "MonetaryAmount",
      currency: job.currency,
      value: { "@type": "QuantitativeValue", minValue: lo, maxValue: hi, unitText: UNIT[job.payPeriod] },
    };
  }
  return ld;
}

/** Safe to put inside a script tag: `<` is escaped so a title cannot close the tag. */
export const ldScript = (ld: Record<string, unknown>) => JSON.stringify(ld).replace(/</g, "\\u003c");
