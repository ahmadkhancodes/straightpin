# Straightpin by BufferSol: design brief (rewrite, 12 Nov 2026)

Supersedes the "Now Hiring notice on warm paper" direction in `docs/DESIGN.md` §3 to §6 (that file now points here). Reason: the founder called the old UI "typical Claude style". He was right. The old palette was warm cream paper `#F6F1E9` with a terracotta accent `#B8381C`, a Bricolage Grotesque display face and a Caveat handwriting note. That is close to the Anthropic/Claude brand look (cream plus clay orange plus a soft grotesque), and it is the look many AI-generated sites now share.

## 1. Competitor and taste audit (live captures, 12 Nov 2026)
Captures at 1440 and 375 in `docs/design/refs/2026-11/` (older 5 Nov set in `docs/design/refs/`). Hiring Cafe, Indeed and NYT blocked our headless browser (Cloudflare or bot wall; not bypassed). FlexJobs failed with an HTTP/2 error. GOV.UK Find a Job is closed.

| Site | What we saw | Take away |
|---|---|---|
| DirectRoles (main competitor) | Full-bleed indigo to violet gradient, centred white H1 with an italic word ("Apply *direct*."), white pill CTA with a round arrow, "Rated 5★ by 7,488" pill, three tech job cards with letter avatars (Datadog, Cloudflare, Wise). Inter everywhere. 375 is the same, stacked. | This is the textbook AI template. Every move here is on our ban list. Their sample jobs are wrong for our buyer. |
| Jobright (adjacent, AI job search) | Mint page, black pills, all caps Titillium, an empty black video frame, laurels and "3,000,000 trusted users", 3x / 80% stat strip. | Hype and invented looking numbers. Our scam-wary buyer reads this as risk. |
| Craigslist jobs (what the ICP already uses) | Dense list, blue links, "3h ago", pay per hour, place name above the title, counts next to each category, almost no chrome. | Our buyer reads lists, not cards. Time, pay and place are the three things scanned first. Density is a feature. |
| USAJOBS (public job board) | Navy band, big plain search fields with labels above, square fields, one red primary button, plain words. | Public service clarity reads as trustworthy. Labels above inputs, square edges, strong focus. |
| Job Bank Canada (public job board, captured for the CA persona) | Government list layout, date and employer first. | Same pattern: date, employer, place. |
| Simplify, FlexJobs (5 Nov notes) | Serif display on soft blue dashboards; corporate blue and orange with stock photos. | Nothing to borrow. |

**What they all do:** centred hero on a tinted or gradient field, pill buttons, rounded 12 to 16px cards with a logo tile, star or user count proof, tech roles in the samples, AI in the headline. **What the ICP actually trusts** (from the brief and the plain sites they use): a dated list, the employer's name and web address, the pay per hour, a visible price, a refund line, plain words.

## 2. ICP card
Remote Rhonda, 34, ex call centre, Ohio, Android phone, between shifts. Searches "customer service jobs no agency". Has been burned by agency reposts, ghost jobs and an auto-renew trial. Pays $5 to $11 from her own card, alone, in minutes. Reads newspaper style listings and Craigslist without effort. Trusts dates, employer domains, a price printed in full and a refund promise. Distrusts gradients, AI language, star counts and anything that looks like an app ad. Secondary: Part-time Pat (UK), Laid-off Leo (project coordinator, desktop at the kitchen table).

## 3. Positioning line
For job seekers in the US, Canada and the UK who are tired of agency reposts and ghost jobs, Straightpin by BufferSol is the job list that only prints jobs from the employer's own careers page, with the real first posted date, at $10.99 a month shown before you sign up. Unlike DirectRoles it shows the price on the first screen, a refund promise and a repost count on every job.

## 4. Direction: "the Help Wanted page"
A modern broadsheet classifieds page. Ink on newsprint, column rules, a dated listing column, and one signal colour taken from the yellow and black "Help Wanted" window sign. Recognisable to this buyer (the classifieds and window sign are how ordinary jobs were always found), honest (it is a list of dated facts), and unlike every competitor (no gradient, no pills, no cards with logo tiles, no AI sparkle). It is not a newspaper costume: no fake mastheads, no textures, no Old English type.

Differs from DirectRoles on palette (ink plus signal yellow vs indigo gradient), type (serif headlines plus a grotesque vs Inter), layout (left aligned two column broadsheet vs centred stack), imagery (a live listing column of real components vs three logo tiles), radius (square vs pills) and tone (receipts vs hype).

## 5. Visual system
### Palette (light only, D-052)
| Role token | Hex | Use | Contrast |
|---|---|---|---|
| `--surface` (newsprint) | `#F3F3EF` | page | ink 17.6:1 |
| `--surface-raised` (sheet) | `#FFFFFF` | list sheets, forms, dialogs | |
| `--surface-sunken` | `#E8E8E2` | table heads, wells | |
| `--surface-inverse` | `#121417` | footer band, final CTA | |
| `--text` (ink) | `#121417` | text, primary buttons | 18.6:1 on white |
| `--text-subtle` | `#4A4F57` | secondary text | 8.4:1 on white, 7.6:1 on newsprint |
| `--text-muted` | `#5F646C` | captions | 6.0:1 on white |
| `--border` | `#D3D4CD` | hairlines | |
| `--border-strong` | `#121417` | column rules, inputs at rest use `#8A8E95` | |
| `--action` | `#121417` | primary button fill, links (underlined) | white on it 18.6:1 |
| `--action-hover` | `#2D3138` | | |
| `--signal` / `--highlight` | `#FFD43B` | the Help Wanted yellow: selected chips, "Direct from employer" stamp, focus halo, price marker. Always with ink text | ink on it 13.3:1 |
| `--brand-tint` | `#FFF4C2` | selected rows, tear tab fill | |
| `--marker` | `#1F3F99` | agency and ghost notes, always icon + word | 9.1:1 |
| `--success` | `#0F6B3E` | "Direct from employer" text, success | 6.6:1 |
| `--warning` | `#8A4B00` | "Old posting" (>30 days) | 6.4:1 |
| `--danger` | `#B42318` | errors, always icon + message | 6.1:1 |

No purple, no indigo, no cream, no clay orange. No gradients anywhere. Yellow is never text and never a large background; it marks.

### Type (next/font, self hosted)
| Role | Family | Use |
|---|---|---|
| Display | **Newsreader** 600 (one static weight, small file for LCP) | H1 to H6, the price in the hero and rate card. Broadsheet voice |
| Text and UI | **Archivo** (variable weight) | body, buttons, nav, forms. A sturdy grotesque, legible at 16px on Android. Tracked caps (`kicker`) for the column heads ("CUSTOMER SUPPORT", "RECEIPT", "PRICES"). The width axis was tried and dropped: it cost LCP |
| Mono | **JetBrains Mono** 400/600 | source hosts and URLs only (round 1 used it for prices and dates and it read as a terminal). Prices, pay and counts use tabular lining figures (`figures` utility) |
Dropped: Bricolage Grotesque, Public Sans, Caveat. No italics, no weight 900.

### Grid, rhythm, radius, borders
- 12 column grid, 1200 max, 24 gutter desktop, 16 at 375. Hero is 7/5 asymmetric with a vertical column rule between text and the listing column. Sections are separated by a 2px ink rule with a small caps section head on the rule ("THE PROBLEM", "HOW IT WORKS", "PRICES"), like newspaper section heads, and the section padding varies (64, 96, 48) by content weight.
- Radius: **0** on surfaces (sheets, lists, tables, dialogs, cards: paper is square), **4px** on controls (buttons, inputs, chips). Nothing is pill shaped. Implemented by overriding `--radius-sm` to 0 and `--radius-md`/`--radius-lg` to 4px in the theme.
- Borders: hairline `--border` between list rows, 1px ink rule on top of every sheet, no shadows at rest. Selected chip: yellow fill + ink border.
- Focus: 3px ink outline with a yellow halo (the public service pattern this buyer meets on government sites). Tap targets 44px minimum.

### Imagery
Only the real product UI: the listing row component (`ListingRow`) with realistic, labelled sample data (call centre, data entry, admin roles; employer domains like `boards.greenhouse.io`), the agency receipt, the match counter, the pricing table. No icons in rounded squares, no emoji, no stock art.

### Motion
Counter digit flip and the tear tab slide (transform only, 160 to 240ms, `cubic-bezier(.22,1,.36,1)`), fade on reveal. All off under `prefers-reduced-motion`.

### Copy rules
Plain, dated, specific. No "streamline, seamless, supercharge, unlock, everything you need". No invented numbers: every count on the landing page is either the live database total or labelled as an example.

## 6. App
Same system. Matches is a dense listing column (row per job: title, employer, place, pay, posted date in mono, repost count, Direct from employer stamp) with a sticky filter bar; one primary action per screen (Matches: "Open at company"; Saved: "Open"; Alerts: "Save alert"; Account: none, billing actions are secondary). Marketing and job pages share one ink-ruled header with text navigation and a current-page underline (Account replaces Log in when signed in); the `/app` area keeps its sidebar, restyled (yellow current item, ink rule). At 375 the matches filters fold behind one "Refine this list" toggle and the job page Apply strip sticks to the bottom of the screen. Empty states print a sample row and one next action.

## 7. Self-critique log
See `docs/design-qa.md` (scored against Playbook §9, three rounds on hero, matches and pricing). Final screenshots in `docs/qa/design/`.
