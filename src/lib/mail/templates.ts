import { product } from "@/config/product";

// Plain, accessible HTML email templates (no external CSS, no images). Each returns {subject, text, html}.
// Kept dependency free instead of react-email to stay small; the shape matches react-email's render output.
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, bodyHtml: string, footer = `${product.fullName} · ${product.company}`) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;padding:24px;background:#f7f7f7;font-family:ui-sans-serif,system-ui,sans-serif;color:#181818">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e2e2;border-radius:8px">
<tr><td style="padding:32px">
<p style="margin:0 0 24px;font-size:14px;font-weight:600">${esc(product.name)}</p>
${bodyHtml}
</td></tr></table>
<p style="max-width:520px;margin:16px auto 0;font-size:12px;color:#767676">${esc(footer)}</p>
</body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${esc(href)}" style="display:inline-block;padding:12px 16px;background:#181818;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600">${esc(label)}</a></p>`;

export function magicLinkEmail(url: string) {
  const subject = `Sign in to ${product.name}`;
  const text = `Use this link to sign in to ${product.name}. It works once and expires in 10 minutes.\n\n${url}\n\nIf you did not ask for this, you can ignore this email.`;
  const html = layout(subject, `<h1 style="margin:0 0 8px;font-size:20px">Sign in to ${esc(product.name)}</h1>
<p style="margin:0;font-size:14px;line-height:20px;color:#404040">This link works once and expires in 10 minutes.</p>
${button(url, "Sign in")}
<p style="margin:0;font-size:12px;line-height:16px;color:#767676;word-break:break-all">Or paste this address into your browser: ${esc(url)}</p>
<p style="margin:16px 0 0;font-size:12px;color:#767676">If you did not ask for this, you can ignore this email.</p>`);
  return { subject, text, html };
}

export function otpEmail(code: string) {
  const subject = `${code} is your ${product.name} code`;
  const text = `Your ${product.name} sign-in code is ${code}. It expires in 10 minutes.`;
  const html = layout(subject, `<h1 style="margin:0 0 8px;font-size:20px">Your sign-in code</h1>
<p style="margin:16px 0;font-size:30px;letter-spacing:4px;font-family:ui-monospace,monospace;font-weight:600">${esc(code)}</p>
<p style="margin:0;font-size:14px;color:#404040">It expires in 10 minutes.</p>`);
  return { subject, text, html };
}

export function inviteEmail(opts: { orgName: string; inviter: string; url: string; role: string }) {
  const subject = `${opts.inviter} invited you to ${opts.orgName} on ${product.name}`;
  const text = `${opts.inviter} invited you to join ${opts.orgName} on ${product.name} as ${opts.role}.\n\nAccept: ${opts.url}`;
  const html = layout(subject, `<h1 style="margin:0 0 8px;font-size:20px">Join ${esc(opts.orgName)}</h1>
<p style="margin:0;font-size:14px;line-height:20px;color:#404040">${esc(opts.inviter)} invited you as ${esc(opts.role)}.</p>
${button(opts.url, "Accept invitation")}`);
  return { subject, text, html };
}

export function noticeEmail(opts: { title: string; body: string; actionUrl?: string; actionLabel?: string }) {
  const text = `${opts.title}\n\n${opts.body}${opts.actionUrl ? `\n\n${opts.actionUrl}` : ""}`;
  const html = layout(opts.title, `<h1 style="margin:0 0 8px;font-size:20px">${esc(opts.title)}</h1>
<p style="margin:0;font-size:14px;line-height:20px;color:#404040">${esc(opts.body)}</p>
${opts.actionUrl ? button(opts.actionUrl, opts.actionLabel ?? "Open") : ""}`);
  return { subject: opts.title, text, html };
}

export interface DigestJob { title: string; company: string; place: string; line: string; url: string }

/** Daily digest and instant alert: a short list of jobs with direct links, a receipt line and a one click unsubscribe. */
export function digestEmail(opts: { kind: "digest" | "alerts"; total: number; jobs: DigestJob[]; moreUrl: string; unsubscribeUrl: string; manageUrl?: string; /** Name of the saved alert this email is for, like "Customer support · Toronto, CA". */ label?: string; receipt?: string }) {
  const n = opts.total;
  const subject = opts.kind === "digest"
    ? `${n} new ${n === 1 ? "job" : "jobs"} for you today`
    : opts.label
      ? `${n} new ${n === 1 ? "match" : "matches"} for ${opts.label}`
      : `${n} new ${n === 1 ? "match" : "matches"} straight from company pages`;
  const more = n > opts.jobs.length ? `${n - opts.jobs.length} more are waiting in your matches.` : "";
  const text = [
    subject,
    "",
    ...opts.jobs.map((j) => `${j.title}\n${j.company} · ${j.place}\n${j.line}\n${j.url}\n`),
    more,
    `See all: ${opts.moreUrl}`,
    opts.receipt ?? "",
    "",
    opts.manageUrl ? `Change or delete your alerts: ${opts.manageUrl}` : "",
    `Unsubscribe in one click: ${opts.unsubscribeUrl}`,
  ].filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n");
  const items = opts.jobs
    .map((j) => `<li style="margin:0 0 16px"><a href="${esc(j.url)}" style="font-weight:600;color:#181818">${esc(j.title)}</a><br><span style="font-size:14px;color:#404040">${esc(j.company)} · ${esc(j.place)}</span><br><span style="font-size:13px;color:#767676">${esc(j.line)}</span></li>`)
    .join("");
  const html = layout(
    subject,
    `<h1 style="margin:0 0 16px;font-size:20px">${esc(subject)}</h1>
<ul style="margin:0;padding:0 0 0 20px">${items}</ul>
${more ? `<p style="margin:0;font-size:14px;color:#404040">${esc(more)}</p>` : ""}
${button(opts.moreUrl, "See all my matches")}
${opts.receipt ? `<p style="margin:0;font-size:12px;color:#767676">${esc(opts.receipt)}</p>` : ""}
<p style="margin:16px 0 0;font-size:12px">${opts.manageUrl ? `<a href="${esc(opts.manageUrl)}" style="color:#767676">Change or delete your alerts</a> · ` : ""}<a href="${esc(opts.unsubscribeUrl)}" style="color:#767676">Unsubscribe in one click</a></p>`,
  );
  return { subject, text, html };
}

/** Refund confirmation (transactional). `amountText` like "$10.99". */
export function refundEmail(opts: { amountText: string; planName: string }) {
  const subject = `Your ${product.name} refund of ${opts.amountText} is on its way`;
  const text = `We refunded ${opts.amountText} for your ${opts.planName} plan and turned the plan off. Refunds usually reach your card in 5 to 10 business days.\n\nYour free account stays open. Questions: ${product.supportEmail}`;
  const html = layout(subject, `<h1 style="margin:0 0 8px;font-size:20px">Refund issued</h1>
<p style="margin:0 0 12px;font-size:14px;line-height:20px;color:#404040">We refunded ${esc(opts.amountText)} for your ${esc(opts.planName)} plan and turned the plan off. Refunds usually reach your card in 5 to 10 business days.</p>
<p style="margin:0;font-size:14px;line-height:20px;color:#404040">Your free account stays open. Questions: <a href="mailto:${esc(product.supportEmail)}" style="color:#181818">${esc(product.supportEmail)}</a></p>`);
  return { subject, text, html };
}

/** Renewal reminder with the price, the date, and how to cancel. */
export function renewalReminderEmail(opts: { planName: string; amountText: string; intervalText: string; dateText: string; accountUrl: string; unsubscribeUrl: string }) {
  const subject = `${opts.planName} renews on ${opts.dateText}`;
  const text = `Your ${product.name} ${opts.planName} plan renews on ${opts.dateText} for ${opts.amountText} ${opts.intervalText}.\n\nTo cancel or change your card, open your account: ${opts.accountUrl}\nCancelling takes two taps and you keep the plan until the date above.\n\nStop these reminders: ${opts.unsubscribeUrl}`;
  const html = layout(subject, `<h1 style="margin:0 0 8px;font-size:20px">${esc(subject)}</h1>
<p style="margin:0;font-size:14px;line-height:20px;color:#404040">Your ${esc(opts.planName)} plan renews for ${esc(opts.amountText)} ${esc(opts.intervalText)}. Cancelling takes two taps and you keep the plan until that date.</p>
${button(opts.accountUrl, "Open my account")}
<p style="margin:16px 0 0;font-size:12px"><a href="${esc(opts.unsubscribeUrl)}" style="color:#767676">Stop renewal reminders</a></p>`);
  return { subject, text, html };
}
