# Landing page: identity and design library compliance (12 Nov 2026)

`before-*` = main at e49948b, `after-*` = this change. `home` = full page, `hero` = first screen. Light only, reduced motion (so the tagline shows in full ink).

## Uniqueness

| | Straightpin |
|---|---|
| Palette | newsprint `#F3F3EF`, sheet `#FFFFFF`, ink `#121417`, subtle `#4A4F57`, rule `#D3D4CD`, Help Wanted yellow `#FFD43B` (marks and the primary button, always with ink), marker blue `#1F3F99` (agency notes) |
| Fonts | display Newsreader 600, body and UI Archivo, mono JetBrains Mono (source hosts only) |
| Radius feel | square: 0 on surfaces, 4px on controls, no pills |
| Layout type | B (split hero: statement left, proof right) on a 12 column broadsheet grid, because the product is a list and the visual has to be a real listing, not an illustration |
| Hero composition | ruled masthead line with the live crawl status, 7/5 split with a column rule, the price highlighted in yellow under the subhead, one yellow sign CTA; right column is one classifieds column of three sample listings |
| Signature element | the tear off "Apply at company" tab on a perforated rule, and small caps section heads on 2px ink rules |

How it differs from the other six: the only serif display face and the only ink on newsprint broadsheet with a yellow sign; no warm paper or stamp (Postslot), no green (Wirebook), no stencil or steel (DockCrate), no navy (Hotrail), no blueprint grid (Stepclimb), no white docs layout (Inboxwire).

## Measured after the change (local `next start`)

- Hero h1 661px and subheading 600px at 1440; 358px at 390; no sideways scroll at 390.
- Every text size on `/` is a Tailwind step; weights 400/500/600/700; no italics; no hyphenated copy; radii 0 and 4px; no gradients.
- Transitions: all on `cubic-bezier(0.22,1,0.36,1)`, 300ms colour/opacity, 500ms transform.
- Tagline: words light up line by line while scrolling (0, 6, 12, 17, 22 of 22 per 60px step); full ink at once with reduced motion.
- Lighthouse 12 mobile performance: `/` 96 to 97, `/pricing` 96 (was 95 and 96).
