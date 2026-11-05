# Straightpin by BufferSol: visual system (DESIGN.md)

Owner direction: design is priority #1. Source: docs/brief.md "Design direction", docs/factory/DESIGN_PLAYBOOK.md, landing-page-design skill. Competitor audit: docs/design/COMPETITOR_NOTES.md. Proof: docs/design/mock.html (+ PNGs).

## 1. Positioning
For job seekers in the US, Canada and the UK who are tired of agency reposts and ghost jobs, Straightpin by BufferSol is the job board that shows only jobs posted on the employer's own careers page, with the date it was really first posted, at $10.99 a month shown before you sign up. Unlike DirectRoles it prints a price on the first screen, a refund promise and a repost count on every job.

**Layout type: A (classic hero + sections), with the hero being a live notice board.** Reason: product is understandable from the hero UI, and traffic from TikTok/SEO is warm. Comparison pages use type D.

## 2. ICP card (drives everything)
Remote Rhonda, 34, ex call center, Ohio. On her phone between shifts, Android. Scam wary. Has used Indeed and LinkedIn apps, seen reposts, was burned by an auto renew trial. Pays $5 to $11 from her own card in one sitting, alone, in minutes. Trusts: plain words, a date, the employer's own domain, a visible refund. Fears: "Is this a scam?", "Why pay to see jobs?". She is not a developer: no dark terminal look, no AI sparkle.

## 3. Concept: the Now Hiring window notice
Each job is a paper notice on a calm board. The apply action is a perforated tear off tab ("Apply at company", ATS host printed on it). Agency and ghost signals are margin notes. Mood: plain spoken, fresh, direct, calm, accountable. No corkboard skeuomorphism (no wood, no pins with shadows, no clip art).

**Signature move (one per page):** the tear off tab. Tap slides the tab 6px, the perforation opens (transform only, 160ms), then the employer's page opens. In the hero it is a live, real component. Second: the match counter ticks like a flip number.

## 4. Palette (hex tokens, role names)
Flat surfaces only. No background gradients. One accent: **pushpin tomato** (saturation about 73%). Changed 5 Nov 2026 on orchestrator review: the first draft was teal, the fourth dark green in the BufferSol batch; this is the only consumer product, so it is warmer and friendlier, with warm paper neutrals, and the margin notes use ballpoint blue so red keeps one job (actions).

| Token | Light | Dark ("Night board") | Use |
|---|---|---|---|
| `--color-board` | #F6F1E9 | #1A1512 | page background (warm paper) |
| `--color-paper` | #FFFDF9 | #241D19 | notice cards, sheets |
| `--color-ink` | #1F1A17 | #F1EAE2 | text (15:1 on board) |
| `--color-ink-muted` | #5C524B | #B5A99F | secondary text (6.8:1 / 7.2:1) |
| `--color-rule` | #DDD3C6 | #3A302A | borders, perforation |
| `--color-brand` | #B8381C (pushpin tomato) | #FF8A6B | actions, links, focus. White on brand 5.8:1; brand on board 5.2:1; dark ink #2A0F08 on dark brand 7.8:1 |
| `--color-brand-hover` | #8F2B14 | #FFA48A | white on hover 8.3:1 |
| `--color-brand-tint` | #FBE7DF | #3A211A | selected chips, tear off tab fill |
| `--color-brand-on` | #FFFFFF | #2A0F08 | text on brand |
| `--color-highlight` | #FFE45C | #E9CF4A | highlighter behind "Direct to company" and "New today" only; text on it is ink #14201E in both modes |
| `--color-marker` | #2A4B9B (ballpoint blue) | #8FB0FF | margin notes and agency/ghost callouts, always icon + word (8:1) |
| `--color-success` | #1E7B4F | #5BC48C | |
| `--color-warn` | #8A5A00 | #E0A93B | old posting (>30 days), 5.8:1 |
| `--color-error` | #B42318 | #FF8478 | errors only, never confused with brand because it is always paired with an icon and message |

Two layer model: primitives (ramp) and semantic roles above; components use only roles. Dark mode: via `[data-theme=dark]` and `prefers-color-scheme`; never pure #000.

## 5. Typography
Fonts self hosted at build via `next/font/google` (no runtime font CDN).

| Role | Family | Weights | Notes |
|---|---|---|---|
| Display + UI headings | **Bricolage Grotesque** | 600, 700 | no 800/900 (skill rule: max bold). Optical size axis on. Tracking -0.02em on display |
| Body + UI | **Public Sans** | 400, 500, 700 | 16px minimum on mobile inputs |
| Data | **JetBrains Mono** | 400, 600 | **tiny metadata only**: source host on cards and tear off tab, first posted date in the trust strip. Never for counts, prices, labels, headings, tags or nav (changed 5 Nov: sans carries all UI at 375) |
| Margin note | **Caveat** | 600 | one use only: the "Old posting" margin note. Max 4 words, never body, decorative `aria-hidden` when it duplicates a visible label |

Scale snaps to the Tailwind default steps (skill B1). Named styles: Heading 1 (text-6xl desktop, text-4xl mobile) ... Caption 5, defined once as classes `heading-1` ... `caption-5`. Hero H1 uses Heading 1 on desktop; on 375 it uses Heading 3 (36/40). `text-wrap: balance` headings, `pretty` body. No italics anywhere. No hyphens in UI copy (rewrite: "direct to company" becomes "straight from the company" in sentences; the brand mark text "Direct to company" is a label with spaces).

## 6. Scale, radius, spacing, borders
- Spacing tokens only from skill B2 (0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96). Gutter 16 mobile, 24 desktop. Breakpoints 480, 768, 1120.
- Radius: Tailwind values only. Notice card `rounded-sm` (2px, square cornered paper). Controls `rounded-lg` (8px). Quiz chips `rounded-full`. Sheets `rounded-t-2xl`. Nested radius formula respected.
- Borders: all around or none (no left accent bars). Perforation: `1.5px dashed var(--color-rule)` as a full-width separator line, never a side border.
- Shadow: none at rest. Lift on hover: `0 1px 0 var(--color-rule), 0 6px 16px rgb(20 32 30 / .08)`.
- Tap targets 48px mobile, 32px minimum desktop.

## 7. Overrides of the landing-page-design skill (written down per Playbook section 0)
The skill's Part B is one fixed look. These deviations are deliberate, from the ICP card, and logged in DECISIONS.md D-003. Everything else in Part A and B holds (scale snapping, spacing tokens, states, contrast, motion curve, tagline reveal, no italics, no background gradients, no single side borders).

| Skill rule | Our choice | Why |
|---|---|---|
| One typeface, whitelist Geist/Manrope/Poppins | Bricolage Grotesque + Public Sans, mono for data, Caveat margin notes | Brief mandates; the notice concept needs a distinctive display face; Geist/Manrope would read as "dev tool", which is exactly what this ICP distrusts |
| Dark backgrounds only from a 6 value list | Night board #121614 / paper #1B201E | Warm green black fits the brand; documented above |
| Hero heading gradient text #000 to #666 | Solid ink. No gradient at all | A gradient on text reads as "AI template" to scam wary seekers; keeping the skill's no gradient spirit |
| Floating translucent blurred pill nav | Solid paper top bar (desktop), bottom tab bar (app, mobile) | Mobile first job tool; tab bar is the pattern the ICP already uses in Indeed/LinkedIn. Marketing page keeps a compact top bar |
| Banned word "unlock" | UI says "open" (free opens: 5 a day). Internal collection still `unlocks` | Avoids filler and is more honest ("open a job" = spend one view) |
| Icons Phosphor | Phosphor Regular + 3 custom marks (tear off tab, pushpin, company stamp) | Skill-allowed set plus brand marks |

## 8. Density, iconography, imagery, motion, voice
- **Density:** medium. Mobile: single column feed of notice cards (title, company, pay, remote, first posted, source host, trust note). Desktop from 1120px: two pane reader (list left, notice right). No filter walls, no three column dashboards, no hamburger only nav.
- **Iconography:** Phosphor Regular 20/24px. Custom marks as inline SVG. No emoji, no AI sparkles.
- **Imagery:** no people photos, no stock. Real components, and for proof a real screenshot of an employer careers page beside our card (only with permission or of our own test boards; otherwise a labelled recreation). Ink line drawings for empty states (a blank pinned notice). Data viz: small honest numbers ("Posted 2 days ago · 0 reposts"), a 30 day pencil thin sparkline of new jobs. No donuts, gauges or match percentage rings.
- **Motion:** base curve `cubic-bezier(0.22, 1, 0.36, 1)`; duration 500ms position, 300ms hover colour, tear 160ms (documented exception to the 200ms floor, it is a micro interaction on `transform` only), counter 240ms per digit. Only `transform` and `opacity`. Scroll reveals via IntersectionObserver, once. Tagline reveal word by word. `prefers-reduced-motion`: opacity only, tagline instantly full colour, counter jumps. Light haptic `navigator.vibrate(10)` on tear and save. No sound.
- **Voice:** a straight talking friend who works in hiring. Short sentences, plain words, numbers with dates ("3 Nov 2026"). US English, USD. Sentence case. No exclamation marks. Never promise jobs or interviews. Never say rival listings are fake; cite the Indeed policy. Explain "ATS" once as "the hiring system companies use".

## 9. Do / don't
Do: price on the first screen; real dates (varied, not round); employer host printed on every card; margin notes with icon plus word; left aligned layouts; ordinary roles in samples (support, data entry, admin); AA contrast; visible 2px focus ring with 2px offset; skeleton loaders shaped like cards.
Don't: indigo/violet or mint hero; background gradients; glassmorphism; icon in circle cards; three identical feature cards; stock photos; star rating pills; "AI powered"; crossed out prices, countdowns, "spots left", confetti; Inter, Roboto, Arial, Open Sans, Helvetica, IBM Plex, Titillium; italics; 800/900 weight; left border accents on cards; emoji; the words supercharge, revolutionize, seamless, effortless, unlock, empower.

## 10. Why it fits this ICP better than the competitors
1. **Trust before taste.** Rhonda's top question is "Is this a scam?". We answer it with the price, refund and a source host on the first screen; DirectRoles puts a star pill and tech jobs there.
2. **It looks like her world.** A paper notice with a date and tear off tab is the most legible metaphor for "a real job at a real place"; competitors use AI copilot dashboards for software engineers.
3. **Calm over hype.** Tomato on warm paper, left aligned, quiet motion. Jobright is mint and all caps, DirectRoles indigo gradient, Simplify serif plus collage.
4. **Honest signals are the visual.** "Posted 2 days ago · never reposted", the marker note "Old posting, 41 days", and the "We removed 41 staffing agency posts" receipt are design elements nobody else has because nobody else computes them.
5. **Phone first.** Bottom tab bar, 48px targets, one question per screen quiz, 16px inputs.

## 11. Tailwind v4 tokens (to implement in M1)
`@theme { --color-board; --color-paper; --color-ink; --color-ink-muted; --color-rule; --color-brand; --color-brand-hover; --color-brand-tint; --color-brand-on; --color-highlight; --color-marker; --color-success; --color-warn; --color-error; --font-display: var(--font-bricolage); --font-body: var(--font-public-sans); --font-mono: var(--font-jetbrains); --font-hand: var(--font-caveat); --ease-base: cubic-bezier(0.22,1,0.36,1); }` Dark values under `[data-theme="dark"]` and `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }`. Hex literals only inside the theme file (grep gate).

## 12. Note on Caveat
Caveat is slanted by design; it is a handwriting face, used only for margin notes (max 4 words) and always paired with an icon and a word. This is the single exception to "no italics" (italic style is never applied).
