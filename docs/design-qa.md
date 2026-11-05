# Design QA scorecard (M1-B, 5 Nov 2026)

Method: DESIGN_PLAYBOOK §9. Screenshots in `docs/qa/` (`/`, `/pricing`, `/compare/directroles`, `/how-we-check`, `/sign-in`; 375 and 1440, light and dark; from `npm run build && npm start`). Self graded. I looked closely at `/` at 375 light and 1440 dark; the other pages were checked by the overflow script and the e2e, not by eye, so re-grade them in review.

| # | Category | Score | Worst problem |
|---|---|---|---|
| 1 | Message clarity | 4 | Hero has one primary CTA plus a text link; price line is below the CTA, inside the first screen at 375 (e2e asserts it) |
| 2 | ICP fit | 4 | Tomato on warm paper, notice cards, plain copy. Tear off tab is a button that only plays the motion (sample data) |
| 3 | Hero and product proof | 4 | Cards are labelled samples, so proof is real UI but not real data until M2 |
| 4 | Structure and rhythm | 4 | Tagline reveal present; bento varies spans; dark mode final CTA box is light (inverse surface) |
| 5 | Typography | 4 | Named styles only; mono only on host text |
| 6 | Spacing and radius | 4 | Token spacing only; hero stack offsets use `ml-8` / `ml-2` on desktop |
| 7 | Color and contrast | 4 | One accent, flat surfaces. Contrast pairs from DESIGN.md; not re measured on the rendered pages |
| 8 | Motion and states | 3 | Counter digits swap without the 240ms flip (React key swap, no animation yet). Hover, focus and active exist |
| 9 | Content honesty | 4 | Sample counts and companies labelled "sample"; competitor facts dated 3 Nov 2026 from the brief; Indeed/Greenhouse/ClearlyRated/Resume Builder cited by name without links (the brief has no URLs for them) |
| 10 | Responsive and ship | 4 | No horizontal overflow at 375 on the five pages; the e2e asserts 44px on landing buttons and links |

Total 39/50. Below the 40 pass mark only because of motion (counter flip) and the unlinked citations; no category under 3, no hard fail. Residual items go to M2.

## Greps (run from repo root, on `src/app src/components src/content`)
- Arbitrary values `text-[ p-[ m-[ gap-[ rounded-[`: no hits. Fixed: `min-w-[32rem]` -> `min-w-lg`, shadow, 160ms, 6px and highlight ink are now tokens/utilities in `globals.css` (`lift-on-hover`, `tear-open`, `duration-tear`, `text-on-highlight`). `lg:grid-cols-[7fr_5fr]` replaced by a 12 column grid.
- Banned fonts, `bg-gradient|linear-gradient`: no hits (removed the unused kit hero component and the `hero-gradient-text` utility).
- `ease-in-out|ease-linear|transition-all`: no hits.
- Banned words (`supercharge revolutionize seamless effortless unlock empower`): no product facing hits in the new copy. Two internal words remain: "unlocks" in `src/app/api/billing/entitlement/route.ts` (a code comment) and "your phone or laptop unlock" in `docs/account` (a noun, rewrite in review if it matters).
- `href="#"`: no hits. Italic or 800/900 weights: no hits.
- Hex literals outside the theme file: only the generated icon and OG images (`ImageResponse` cannot read CSS variables; they now use tomato and paper) and the `themeColor` meta.
- `grep -rni "postslot\|web3forms\|submission" src`: no hits.
