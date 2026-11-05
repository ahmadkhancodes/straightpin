# Design Playbook: ICP-specific SaaS landing pages and app UI (Next.js + Tailwind)

Audience: AI coding sessions building SaaS marketing pages and product UI.
Goal: output that looks designed for one specific buyer, never like a generic "AI template".

## 0. Provenance and how to read this

Distilled from `elayadesign/ai-design-skills` (MIT, see `LICENSE`). That repo contains two skills and nothing else of substance (no references/, assets/ or examples/ folders):

- `skills/landing-page-design/SKILL.md`: Part A (strategy and structure: intake, page structure, layout types A-D, conversion rules, copy, build order, SEO) and Part B (visual system B1-B11: type, spacing, radius, backgrounds, hero, icons, motion, content realism, states, ship list, mandatory tagline reveal). Ends with an output format and a quick checklist.
- `skills/figma-designer/SKILL.md`: Figma-MCP-only rules (variables, text styles, token tables, component states). Useful to us only for its token naming, the two-layer color model and the state matrix. Do not load it unless a Figma file is involved.
- `scripts/` and `tests/` only validate SKILL.md frontmatter (name matches folder, lowercase-hyphen, name at most 64 chars, description at most 1024 chars). They do not check design quality.

Honest gaps in the repo, which this playbook fills and labels as **[ours]**:

- The repo has NO numeric scorecard, NO competitor research method and NO ICP-to-visual-direction mapping. Sections 2, 3 and 8 are our additions built on the repo's checklists.
- The repo's Part B is one fixed look (Geist/Manrope/Poppins, flat surfaces, six dark backgrounds). Applied unchanged to every product it would produce its own sameness. Rule: **Part A is always followed; Part B values are the default toolkit, and an ICP-driven brand decision (Section 3) may override them when written down in the brief.** The skill itself says "when the user's explicit prompt conflicts with a rule, the user wins".

Tags used below: **[repo]** = a rule quoted or paraphrased from the skill, **[ours]** = our addition.

## 1. Pre-code process (do all of this before the first line of UI)

Write the answers into `docs/design-brief.md` in the target repo. Do not skip steps; do not stall either: if info is missing, state the assumption in one line and continue **[repo A1]**.

1. **Research.** [ours] Open 4-6 competitor and 2-3 "adjacent-category the ICP loves" sites (screenshot at 1440 and 375). Record for each: hero claim, hero visual type, palette, typeface, density, proof style, pricing shape, CTA wording. Look for what everyone shares (that is the category cliche to avoid) and the one gap you can own.
2. **Intake.** [repo A1] Answer in one batch: ONE primary action; exact offer; what counts as a conversion; ICP; the problem; top three objections; traffic source; what visitors know on arrival; proof assets (logos, quotes, numbers, case studies); screenshots or video; guarantee/refund/cancel terms; brand voice; mobile priority.
3. **ICP card.** [ours] One paragraph: job title or role, company size, how they buy (self-serve card vs. demo), what they fear, what tools they already use and love, reading context (desk, phone between jobs, code editor). Visual direction comes from this card, not from taste.
4. **Positioning.** [repo A: "one offer, one audience, one primary action"] One sentence: "For {ICP} who {problem}, {product} is the {category} that {specific outcome}, unlike {competitor approach}." If you cannot fill it with a number or a concrete noun, you do not have positioning yet.
5. **Layout type.** [repo A3] Pick exactly one and justify: A classic hero + sections (default); B long-form story (skeptical buyers, complex product); C minimal conversion page (high-intent, waitlist, download); D comparison page ("X vs Y" search intent).
6. **Section plan.** Output, before code [repo "Output format"]: page outline; hero copy (headline, subheadline, CTA, proof line); 3-5 outcome benefits; 3-step how it works; 6-12 FAQ items; SEO/AEO call (index or noindex); layout recommendation with reason.
7. **Visual system.** [ours, using repo B tokens] Fill the table in Section 3 for this ICP: palette (with contrast pairs), type pairing, density, imagery, motion intensity, tone. Encode it as Tailwind theme tokens in `tailwind.config` / `@theme` before building anything.
8. **Build** section by section in this order [repo A6]: Hero, Benefits, How it works, Proof, FAQ, Final CTA. Never regenerate the whole page; screenshot after each section.
9. **Critique** against Section 8, at 375 and 1440, and iterate until it passes.

Gate: do not write UI code until `docs/design-brief.md` has items 1-7. If the user wants speed, collapse research to 3 competitors, but never skip the ICP card and positioning line.

## 2. Content truth rules (applies to every page)

- **Never invent facts** [repo B8]: prices, guarantees, statistics, customer counts, testimonials and logos must come from the user or a real source. If missing, use a visible placeholder such as `{{price}}` or `{{testimonial}}` and list them in the hand-off. In fictional demos, invented names are fine but should sound like the industry (a logistics tool's customers sound like logistics firms) and numbers should not be suspiciously round (47.3%, not 50%).
- **Be specific** [repo A4]: "Cut weekly reporting from 4 hours to 15 minutes", not "Save time and streamline".
- **Banned filler** [repo B8]: "revolutionize", "supercharge", "cutting edge", "effortless", "transform your workflow", "take it to the next level", "harness the power", "world class". Our additions [ours]: "seamless", "unlock", "empower", "all-in-one platform", "next-generation", "game-changer", "AI-powered" as a headline adjective.
- **Headline formulas** [repo A5]: "{Outcome} without {pain}"; "The {category} for {audience}"; "Ship {result} in {time}".
- **CTA** [repo A5]: verb + what they get ("Start free trial", "Book a demo", "Get the checklist"). Never "Learn more" or "Submit".
- Sentence case for headings and buttons [repo B8]. No exclamation marks in system messages. Errors say what failed and what to do next ("Upload failed. The file is over 20 MB.").
- Repo copy quirks to obey: no hyphens inside body copy, headings or labels (rewrite the phrase); no single orphan word on the last line (`text-wrap: balance` on headings, `pretty` on body); hero H1 without periods, split ideas by line break.

## 3. Deriving a visual direction from the ICP and competitors [ours]

Method: (a) from the competitor audit, list the category defaults (e.g., every dev tool is dark + purple glow + terminal mock); (b) from the ICP card, decide what this buyer trusts; (c) pick a direction that is recognizably in the buyer's world but deliberately differs on at least two axes (palette, type, layout, imagery) from the three closest competitors.

| ICP | Palette | Type pairing | Density | Imagery | Tone |
|---|---|---|---|---|---|
| **Dev-tool buyers** (engineers, platform teams) | Near-black or warm off-white, one saturated accent used for state and links only; syntax-highlight colors as secondary palette; hairline borders | Geometric sans (Geist) + Geist Mono for code/data; mono is functional, not decoration | High. Tables, code, CLI output, changelog-style proof | Real code, real terminal or real dashboard crops, benchmarks; no stock photos, no abstract 3D blobs | Dry, precise, numbers first. Docs link beside the CTA. Never marketing-speak |
| **Agency owners** (5-50 person studios) | Confident, editorial: warm paper neutrals or deep ink, one bold brand hue; allowed to feel like a design object | Grotesk or humanist sans headlines (Manrope/Poppins) with generous size contrast; large type moments | Medium. Big whitespace, portfolio-style proof, client-result cards | Real client work, before/after, people. Case studies with revenue or hours saved | Peer-to-peer, ambitious, margin and utilization language. Show how it makes the agency look good to its clients |
| **SMB operators** (clinic, shop, trades, restaurant owners) | Light, warm, approachable; trustworthy blue/green or a friendly brand hue; high contrast; avoid techy dark mode | Highly legible sans, larger body (16-18px+), few weights | Low to medium. One idea per screen, big buttons, obvious next step | Photos of the owner's world (real counters, vans, calendars) plus a clean product screenshot of the one screen they use daily | Plain words, money and time saved, phone number visible, "no contract / cancel anytime" and human support prominent |
| **Creators** (YouTubers, writers, course makers) | Expressive, platform-native: bolder color, personality, rounded shapes, tasteful dark for video tools | Characterful display weight for headlines (still no ultra-bold 900 per repo), clean sans for UI | Medium, visual-first, lots of the creator's own output | Real creator results: audience numbers, payout screenshots, embedded sample outputs | First person, outcome = income or audience growth, fast time to first result |
| **Enterprise / finance / health** | Restrained, cool neutrals, one muted accent, strict contrast | Neutral grotesk, mono for figures | Medium-high, structured | Product UI + security badges, named customers (only real) | Formal, risk-reduction first: SOC 2, SSO, uptime (only if true) |

Direction output (fill in the brief, then codify in Tailwind theme tokens):

1. **Palette:** neutral ramp (10 shades) + ONE accent kept under about 80% saturation [repo figma-designer] + semantic red/green/yellow. Name tokens by role (`surface`, `text-subtle`, `action`) not by color [repo figma-designer]. Provide light and dark via CSS variables, not duplicated hardcoded colors.
2. **Type:** one typeface per site [repo B1]; a second only if the brief justifies it, and Geist Mono only for code/data. Repo whitelist: Geist, Manrope, Geist Mono, Poppins. Repo ban: Inter, Roboto, Arial, Open Sans, Helvetica. No italics. No 900 weight.
3. **Density, imagery, tone:** one line each, from the table.
4. **Signature move:** one memorable, ownable element per page (a product-UI interaction in the hero, a distinctive proof format, a typographic moment). Without one, the page is generic.

Override rule: if the ICP calls for a palette or font outside the repo defaults (e.g., SMB warm light theme, brand-mandated font), record the override and the reason in the brief; keep every Part A rule and the structural Part B rules (scale snapping, spacing tokens, states, contrast, motion curve).

## 4. Landing page section architecture

Order from the repo [A2], with our guidance:

**Above the fold (all required)**
1. Headline: outcome + audience. Max width 680px, meaningful line breaks [repo B5].
2. Subheadline: how, with specifics. Also max 680px.
3. One primary CTA (verb + what you get). Secondary action must be visually subordinate (text link or ghost). Never competing CTAs above the fold [repo A4/A8].
4. One proof signal directly adjacent: logo strip, stat or short quote (real only).
5. Hero visual: **real product UI**, built as an actual React component with believable data, not a screenshot of a blank state, not an abstract gradient orb, not a stock photo. Crop it so the key outcome is legible at 375px (crop to one panel on mobile rather than shrinking the whole app).

**Mid page: the argument**
6. Problem to solution (one section; name the pain in the buyer's own words).
7. Benefits, 3-5, each outcome-driven with its proof beside it [repo A4]. Vary the layout: zig-zag, asymmetric grid or bento. Do not default to three equal cards [repo figma-designer: "Don't default to three equal cards in a row"].
8. How it works, 3 steps, each with a real UI fragment.
9. Social proof: testimonials with full specific names, role and company; one case study with a number.
10. **Tagline reveal section** [repo B11, mandatory]: a separate, large statement of the core benefit, at least two lines, Heading 3 to 1 style, max width capped, words start at about 25-35% opacity and activate one at a time on scroll (IntersectionObserver per word, base easing curve, never a linear fade), full color immediately under `prefers-reduced-motion`. Place after the hero or after benefits, not stacked directly under the hero.

**Bottom: objection handling**
11. Pricing (if self-serve), see rules below.
12. FAQ, 6-12 real objections, plain Q and A (add FAQ schema) [repo A7]. For high-friction offers, move it earlier [repo A4].
13. Risk reversal: free trial / free plan / no card / cancel anytime / refund. At least one [repo A4].
14. Final CTA identical to the top one.

**Conversion rules**
- One offer, one audience, one action. Mirror the ad or source headline in the hero [repo A4].
- Put proof beside the claim it supports, not buried at the bottom [repo A4/A8].
- Features say what it does; benefits say what it means; write benefit first, bold benefit then detail.
- Treat objections as a section, not a footnote.

**Pricing table rules** [ours, consistent with repo "no invented facts" and "align shared elements"]
- Max 3 plans plus "Contact sales"; highlight one plan using border and a label, not a rainbow gradient.
- Titles, prices, feature lists and buttons align on shared Y across cards.
- Price is the largest element; state the billing unit ("per seat / month, billed annually"); monthly/annual toggle states the saving as a number.
- Feature rows are differences between plans, grouped; do not list 25 checkmarks. Use plain text for limits ("5 projects", "50,000 events").
- Every plan has a CTA with its own verb ("Start free", "Book a demo"). Add risk-reversal text directly under the buttons.
- Real prices only; otherwise `{{price}}`.

**Do**
- Real product UI in the hero, with believable data and varied dates [repo B8].
- A distinct section layout rhythm (full-bleed, split, bento, list) rather than repeating one card pattern.
- Logos, quotes and numbers only from real sources or marked placeholders.
- Footer with privacy policy and terms; branded 404, favicon, OG tags [repo B10].

**Don't**
- Centered hero + three identical icon cards + purple gradient (the "AI template" signature).
- Fake logo walls, fake "10,000+ teams", made-up testimonials.
- Multiple primary CTAs above the fold; a nav with 8 links on a conversion page.
- "Learn more" CTAs, dead `#` links, carousels hiding proof.

## 5. Typography, spacing, radius [repo B1-B3, with implementation notes]

**Type scale.** Only Tailwind's default steps; arbitrary values (`text-[19px]`) are banned. If a size lands between steps, snap to the closest step below and take its line height.

Named styles (define once as classes/tokens in kebab-case: `heading-1`, `title-3`, `body-4`, `button-md`, `caption-2`; never repeat loose size+weight utilities):

| Group | Steps (size/line height, weight) |
|---|---|
| Heading 1-6 | text-6xl 60/60, 5xl 48/48, 4xl 36/40, 3xl 30/36, 2xl 24/32, xl 20/28; Semibold (repo landing skill) |
| Title 1-5 | xl, lg, base, sm, xs; Medium |
| Body 1-3 / 4-6 | base 16/24 and sm 14/20; Semibold, Medium, Regular |
| Button-lg/md/sm/Xsm | 18, 16, 14, 12; Semibold; main buttons use Button-md |
| Caption 1-5 | sm and xs; metadata, badges, timestamps, fine print |

Use: Heading = page/section heads (H1 is the hero); Title = card titles, nav, lead-in labels; Body = running text; Button = buttons only; Caption = helper text.

Implementation in Tailwind (v3 `@layer components` or v4 `@utility`): one class per style. On mobile, step the hero down one size (e.g., `heading-3 md:heading-1`) rather than inventing an off-scale size. [ours]

**Spacing.** Only these: 0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96px (Tailwind `0, 0.5, 1, 2, 3, 4, 6, 8, 10, 12, 16, 20, 24`). Nothing in between. Main buttons: 8px vertical, 12px horizontal padding (py-2 px-3). Section padding: 80-96px desktop, 48-64px mobile [ours]. Restrict the Tailwind spacing scale in the theme so off-token values cannot compile. [ours]

**Radius.** Tailwind values only. Nested formula [repo B3]: when an inner shape sits inside an outer one with gap under 32px, `inner radius = outer radius - gap`, applied only if the result is greater than 2 (otherwise leave it square). Example: card `rounded-2xl` (16) with 8px padding gives inner `rounded-lg` (8). Pick one radius personality per site (sharp for dev/enterprise, 12-16 for SMB/creators) [ours].

**Content widths** [repo figma-designer]: 1440 desktop frame, centered container 1200-1280 (`max-w-7xl`), hero heading/subheading 680 max.

## 6. Color, surfaces, borders, icons

- **Flat backgrounds; no background gradients** [repo B4], including buttons and fade overlays. Depth comes from surface steps, hairline borders and shadows that are subtle and consistently directed [ours].
- **Only gradient allowed:** hero heading text, left to right. Dark theme `#FFFFFF` to `#9B9B9B`; light theme `#000000` to `#666666` [repo B5]. Verify contrast at the lightest end.
- **Dark-mode backgrounds, only:** `#000000`, `#181818`, `#1F1F1F`, `#272727`, `#313131`, `#131209` [repo B4]. (Override per Section 3 only if the brand requires.)
- **Borders go all the way around or not at all.** No single-sided card borders (use a 1px divider element between rows) [repo B4, figma-designer].
- **One accent color**, under 80% saturation; semantic red/green/yellow only for state [repo figma-designer].
- **Two-layer tokens** [repo figma-designer]: raw palettes (10+ shades from 00 to 1000) then semantic role tokens (`surface/primary`, `text/subtle`, `action/primary-hover`, `border/error`) with light and dark modes. In Next.js: CSS variables for roles, switched by `data-theme` / `prefers-color-scheme`; components reference roles only, so a rebrand edits one file.
- **Contrast** [repo figma-designer]: body 4.5:1; large text (24px+, or 18px bold+) and UI parts (icons, input borders, focus rings) 3:1; touch targets at least 44x44 on mobile; never color alone for state. If the brand color fails with white text, darken the action shade.
- **Icons** [repo B6]: Phosphor, Solar or Iconamoon only; never Material. One stroke weight across the site. Import as SVG React components, color via `currentColor`/role tokens. **No emoji as icons**, no icon-in-a-circle on every card [ours]; prefer product UI fragments or a typographic treatment where an icon adds nothing.

## 7. Motion, states and ship requirements

**Motion** [repo B7]
- Curve: `ease-[cubic-bezier(0.22,1,0.36,1)]`. `duration-500` for layout/position, `duration-300` for color/opacity on hover, never under 200ms. Never `ease`, `linear`, `ease-in-out` defaults.
- Animate only `transform` and `opacity`; never `top/left/width/height`.
- Scroll reveals: rise 32px and fade 0 to 1 over 600-800ms, once only, via IntersectionObserver or Framer Motion `whileInView`. No unthrottled scroll listeners.
- `prefers-reduced-motion`: replace movement with a plain opacity change.
- Nav: compact floating bar off the top edge, translucent with backdrop blur; animated menu toggle icon; mobile menu is a full-height panel; links enter staggered 60ms apart, 24px rise, total at most 400ms.
- Restraint [ours]: one orchestrated entrance and one signature interaction beat a dozen micro-animations.

**States** [repo B9]: every interactive element has hover, active (`scale(0.98)` or 1px translate), focus (visible ring), loading (skeleton shaped like the real layout, no circular spinners), empty (composed getting-started view), error (inline and specific, never `alert()`). Buttons: primary, secondary, tertiary, error, warning, each across default/hover/pressed/focus/disabled [repo figma-designer]. Nav shows the current page. No dead links.

**App UI additions** [ours, from the repo's state and token rules]: data tables with sticky headers and tabular numerals (`tabular-nums`); empty states that teach the next action; density toggle for pro tools; keyboard shortcuts visible for dev/pro ICPs; confirmations calm and specific ("Invoice sent to Dana").

**Ship list** [repo B10]: privacy and terms links; branded 404; client-side validation (email, required); skip-to-content link; cookie consent where required; favicon; `<title>`, meta description, `og:image`, social tags (Next.js `metadata` API); alt text; semantic HTML (`nav`, `main`, `section`, `article`, `aside`); way back from every page; 390px check with no horizontal overflow and the primary action visible in the first screen. SEO [repo A7]: noindex ad-only/time-bound campaign pages; index evergreen pages with title, meta, internal links and FAQ schema.

## 8. Anti-"AI look" bans

Repo bans [repo]: Inter/Roboto/Arial/Open Sans/Helvetica; italics; weight 900; background gradients; single-side card borders; Material icons; arbitrary font sizes and off-token spacing; default easing; vague filler words; eyebrow pills above headings (not by default, unless asked); three equal cards as the default grid; placeholder copy and stock names like "Acme"; invented stats and testimonials.

Our additions [ours]: default purple/indigo-to-pink gradients and glow blobs; emoji as icons or bullets; centered hero + 3 identical feature cards + logo strip + pricing as the whole page; glassmorphism on everything; identical rounded-2xl cards with icon-in-circle; fake dashboards with lorem data or round numbers; gradient text beyond the one hero heading; stock illustrations of people at laptops; "Trusted by thousands" with no names; every section centered; same section padding and rhythm repeated 8 times; testimonial avatars all from one generator style.

Replace them with: ICP-driven palette and type; real product UI; asymmetric or bento layout; specific numbers; one signature moment.

## 9. Self-critique and QA rubric [ours, built from the repo's Quick Checklist]

The repo ships only a pass/fail checklist (Strategy, Visual, Content and ship). We convert it to a scorecard so a session can grade itself.

**Procedure**
1. Run the app. Capture full-page and above-the-fold screenshots at **375x812** and **1440x900** (Playwright: `page.screenshot({fullPage:true})`; also capture hover/focus on the primary CTA and dark mode if supported).
2. Open each screenshot and grade honestly against the table. Write scores and the single worst problem per category into `docs/design-qa.md`.
3. Fix the lowest-scoring category first, rebuild that section only, re-capture, re-grade. Repeat.
4. **Pass = total at least 40/50 AND no category below 3 AND every "hard fail" clear.** Max 5 iterations; then list residual issues in the hand-off.

| Category (0-5) | Score 5 looks like |
|---|---|
| 1. Message clarity | 5-second test: a stranger from the ICP can say what it is, who it is for and what to click. Specific number or noun in the H1. One primary CTA |
| 2. ICP fit | Palette, type, imagery, tone visibly match the ICP card and differ from the closest competitors on at least two axes |
| 3. Hero and product proof | Real product UI in hero, believable data, legible at 375; proof signal adjacent to the claim |
| 4. Structure and rhythm | Sections follow Section 4; layout varies (not 3 equal cards); tagline reveal present; objections and risk reversal handled |
| 5. Typography | Only scale steps and named styles; one family; hierarchy readable by squinting; no orphans; line breaks at meaningful points |
| 6. Spacing and radius | Only token spacing; consistent section rhythm; nested radii follow the formula; aligned shared Y in card rows |
| 7. Color and contrast | One accent; flat surfaces; hero-text gradient only; 4.5:1 body, 3:1 large and UI; works in dark/light as designed |
| 8. Motion and states | Correct curve, transform/opacity only, reduced-motion handled; hover/focus/active/loading/empty/error all present |
| 9. Content honesty | No invented facts (placeholders marked), no banned words, specific names and numbers, sentence case |
| 10. Responsive and ship | At 375: no horizontal scroll, text not clipped, 44px targets, CTA visible in first screen; ship list complete |

**Hard fails (auto-fail until fixed)**
- Any banned font, italic, 900 weight, background gradient, single-side card border, Material icon or emoji icon.
- Arbitrary font size or spacing value outside the token tables (grep the code for `text-[`, `p-[`, `gap-[`, `#` literals outside the theme file).
- Horizontal overflow at 375 or 390.
- Invented stats, logos, testimonials or prices without a placeholder marker.
- Missing tagline reveal section, missing focus ring, or missing meta/OG tags.
- Hero where the 5-second test fails.

**Quick greps** [ours]: `rg "text-\[|p-\[|m-\[|gap-\[|rounded-\[" src`; `rg "Inter|Roboto|Arial|Helvetica|Open Sans" src app`; `rg "bg-gradient|linear-gradient" src app`; `rg "ease-in-out|ease-linear|transition-all" src app`; `rg "supercharge|revolutionize|seamless|effortless|unlock" src app`; `rg "href=\"#\"" src app`.

## 10. Using the skill files

- **Install** (in the target repo): `mkdir -p .claude/skills && cp -r <this-kit>/skills/landing-page-design .claude/skills/` (folder name must equal the `name:` in the frontmatter). Optional for Figma work only: `cp -r <kit>/skills/figma-designer .claude/skills/` (also needs the official `figma-use` skills). Alternative installer from the source repo: `npx skills add elayadesign/ai-design-skills --skill landing-page-design`. Commit `.claude/skills/` so every session shares it.
- **When to invoke:** at the start of any task that builds, edits, reviews or writes copy for a landing page, marketing site, web UI section, component or prototype. Load it BEFORE choosing sections, headlines, CTAs, fonts, sizes, spacing, radii, colors, icons or transitions. Its own description says to use it even when the user does not mention design.
- **Order of work:** this playbook Section 1 (brief) first, then the skill's Part A (intake and structure), then Part B while building, then Section 9 here for QA.
- **Conflict order:** explicit user prompt, then the written ICP override in `docs/design-brief.md`, then the skill, then framework defaults [repo: "this file wins over framework defaults"].
- **Customizing:** the skill says its design values live in Part B near the bottom; fork and edit there (fonts, colors, spacing, motion) rather than copying rules into prompts.
- **Credits/license:** the skill adapts ideas from Leonxlnx/taste-skill (MIT, license text included at the end of the SKILL.md). Keep `LICENSE` and the skill's credits section intact.
