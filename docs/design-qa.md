# Design QA scorecard

## Redesign "the Help Wanted page" (12 Nov 2026, D-053)
Method: DESIGN_PLAYBOOK §9. Production build (`npm run build && next start`, memory DB with seeded jobs), Playwright screenshots at 1440x900 and 375x812, light only, opened and graded by eye. Final images: `docs/qa/design/` (marketing, full page) and `docs/qa/design/app/` (signed in: quiz, job, saved, alerts, account, paywall, /app, billing, profile, security). Live competitor captures: `docs/design/refs/2026-11/`.

### Iterations
| Round | Hero | Core app screen (matches, job) | Pricing |
|---|---|---|---|
| 1 | Broadsheet hero worked, but mono everywhere read as a terminal (crawl line, pay, the big price) | Listing rows on one ruled sheet read well; signed-in header still said "Log in" | Three cards were replaced by a rate card; Lifetime said "Cancel in two taps" |
| 2 | Mono limited to source hosts; price set in Newsreader with a yellow mark; crawl line was inheriting the condensed kicker | At 375 six filters pushed every job below the fold; job page Apply strip below the fold | Promise box text at 12px; heading order skipped a level |
| 3 | Fixed crawl line; heading-order fix in the listing column; font files trimmed so LCP lands earlier | Filters fold behind one 44px "Refine this list" toggle; Apply strip sticks to the bottom on phones; stamp no longer wraps; header shows Account when signed in; billing has one primary button | Promise box at 14px; plans are h2 on /pricing; Lifetime says "One payment, nothing renews." |

### Score (final)
| # | Category | Score | Worst remaining problem |
|---|---|---|---|
| 1 | Message clarity | 5 | none found: H1, price, refund and one CTA are on the first screen at 375 and 1440 |
| 2 | ICP fit | 5 | Differs from DirectRoles on palette, type, layout, radius, imagery and tone |
| 3 | Hero and product proof | 4 | Hero listing uses labelled sample data until the live crawl has volume |
| 4 | Structure and rhythm | 4 | Section heads on rules and three paddings vary the rhythm; FAQ and compare are still conventional blocks |
| 5 | Typography | 4 | Newsreader + Archivo + mono for hosts only; kicker caps are tracked, not condensed (the width axis was dropped for LCP) |
| 6 | Spacing and radius | 5 | 0 on surfaces, 4px on controls, enforced by theme overrides and a unit test |
| 7 | Color and contrast | 5 | Ink on newsprint, one signal colour that is never text; axe and Lighthouse a11y 98 to 100 |
| 8 | Motion and states | 4 | Hover, focus (ink outline + yellow halo), loading, empty with example row, error; counter flip and tear slide off under reduced motion |
| 9 | Content honesty | 5 | No invented numbers; every example is labelled |
| 10 | Responsive and ship | 4 | No overflow at 375; Monthly is third in the stacked rate card on phones |

Total **45/50**, no category under 4, no hard fail.

### Lighthouse (mobile preset, local production build, 12 Nov 2026)
`/`: performance 95, accessibility 100, CLS 0, LCP 2.9 s. `/pricing`: performance 96, accessibility 98 before the heading-order fix (fixed afterwards, not re-measured), CLS 0, LCP 2.7 s.

### Banned AI tells, checked page by page
Centred hero over a blob: gone (asymmetric 7/5 with a column rule). Purple/indigo: none (unit test). Generic font: Newsreader + Archivo + mono. Three icon cards: replaced by a numbered "How to read a listing" legend and a rate card. Emoji or stock art: none. Glassmorphism: none. One radius everywhere: 0 / 4px system. Pill badges: none (test fails on `rounded-full` outside the spinner). Uniform rhythm: three section paddings plus section heads. Invented stat strips: none. Vague copy: none found with the playbook grep.

---

## History: M1-B to M2 (5 Nov 2026, old tomato direction)

Method: DESIGN_PLAYBOOK §9. Screenshots in `docs/qa/` (`/`, `/pricing`, `/compare/directroles`, `/how-we-check`, `/sign-in`; 375 and 1440, light; from `npm run build && npm start`). Self graded. M2: I now also looked at `/pricing`, `/how-we-check`, `/quiz`, `/matches` and `/job/[id]` at 375 light by eye (screenshots regenerated in `docs/qa/`, now including quiz, matches and job). Fixed from that look: duplicated "Remote, Remote" in the place line, a truncated pay option in the filter, a job with no company date being called "posted today", and the apply tab wrapping beside the host on narrow screens.

| # | Category | Score | Worst problem |
|---|---|---|---|
| 1 | Message clarity | 4 | Hero has one primary CTA plus a text link; price line is below the CTA, inside the first screen at 375 (e2e asserts it) |
| 2 | ICP fit | 4 | Tomato on warm paper, notice cards, plain copy. Tear off tab is a button that only plays the motion (sample data) |
| 3 | Hero and product proof | 4 | Cards are labelled samples, so proof is real UI but not real data until M2 |
| 4 | Structure and rhythm | 4 | Tagline reveal present; bento varies spans; dark mode final CTA box is light (inverse surface) |
| 5 | Typography | 4 | Named styles only; mono only on host text |
| 6 | Spacing and radius | 4 | Token spacing only; hero stack offsets use `ml-8` / `ml-2` on desktop |
| 7 | Color and contrast | 4 | One accent, flat surfaces. Contrast pairs from DESIGN.md; not re measured on the rendered pages |
| 8 | Motion and states | 4 | Counter digits flip in 240ms (transform only, `digit-flip`), switched off under `prefers-reduced-motion` (e2e asserts both). Hover, focus and active exist |
| 9 | Content honesty | 4 | Sample counts and companies labelled "sample"; competitor facts dated 3 Nov 2026 from the brief; the four third party statistics (Indeed policy date, ClearlyRated, Greenhouse, Resume Builder) were removed because the brief has no URL for them; copy now makes no cited claim |
| 10 | Responsive and ship | 4 | No horizontal overflow at 375 on the five pages; the e2e asserts 44px on landing buttons and links |

Total 40/50 (was 39): motion 3 to 4 with the counter flip; the unlinked citations are gone, which keeps honesty at 4. No category under 4, no hard fail. Not yet graded: dark mode of the new M2 pages by eye (screenshots exist), and the landing still shows labelled sample data until the crawl has real volume.

## Greps (run from repo root, on `src/app src/components src/content`)
- Arbitrary values `text-[ p-[ m-[ gap-[ rounded-[`: no hits. Fixed: `min-w-[32rem]` -> `min-w-lg`, shadow, 160ms, 6px and highlight ink are now tokens/utilities in `globals.css` (`lift-on-hover`, `tear-open`, `duration-tear`, `text-on-highlight`). `lg:grid-cols-[7fr_5fr]` replaced by a 12 column grid.
- Banned fonts, `bg-gradient|linear-gradient`: no hits (removed the unused kit hero component and the `hero-gradient-text` utility).
- `ease-in-out|ease-linear|transition-all`: no hits.
- Banned words (`supercharge revolutionize seamless effortless unlock empower`): no product facing hits in the new copy. Two internal words remain: "unlocks" in `src/app/api/billing/entitlement/route.ts` (a code comment) and "your phone or laptop unlock" in `docs/account` (a noun, rewrite in review if it matters).
- `href="#"`: no hits. Italic or 800/900 weights: no hits.
- Hex literals outside the theme file: only the generated icon and OG images (`ImageResponse` cannot read CSS variables; they now use tomato and paper) and the `themeColor` meta.
- `grep -rni "postslot\|web3forms\|submission" src`: no hits.
