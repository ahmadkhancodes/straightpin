# Landing page section plan (layout type A, tagline reveal included)

Rules: no invented stats, testimonials or logos. Anything not in the brief is a marked `{{placeholder}}`. Copy uses sentence case, no hyphens in body text, no exclamation marks. Dated prices: "checked 3 Nov 2026". SEO: index; title "Straightpin by BufferSol: jobs straight from company careers pages"; meta "Jobs posted on the employer's own careers page, staffing agencies removed, first posted date on every job. Free to start. $10.99 a month, 7 day refund."

## Outline (order)
1. Top bar
2. Hero (live notice board + price + CTA)
3. Field chips (8 fields, live counts)
4. Problem: the Indeed policy and ghost jobs, in plain words (with sources)
5. Tagline reveal (mandatory, word by word)
6. How it works (3 steps, real UI fragment each)
7. What is on every notice (bento: trust strip, agency receipt, tear off, alerts, free tier)
8. Compare (honest table, dated sources)
9. Pricing (3 cards + lifetime line + refund promise)
10. FAQ (10 items, FAQPage schema)
11. Final CTA (same as hero)
12. Footer ("A BufferSol product", disclaimer, legal, /bot, /about/data)

## 1. Top bar
Wordmark "Straightpin" + mono "by BufferSol". Links: Jobs, Pricing, How we check. Right: "Log in", button "See my matches". Sticky, solid paper, 1px rule bottom.

## 2. Hero
- H1 (Heading 1, max 680px, break at thought): "Jobs straight from company careers pages. / Half the price."
- Sub: "We check thousands of company hiring pages every hour, drop staffing agency reposts, and show you when each job was really posted."
- Primary CTA: "Pick your field, see your matches" (anchors to the chips; free, no card).
- Price line directly under CTA (ONB-04): "Free to start. Then $10.99 a month, or $4.99 a week. Cancel in two taps. 7 day refund."
- Proof signal adjacent: live count "{{live_count}} direct jobs open today, {{agency_removed}} agency posts removed" (real numbers from DB at render; static placeholder until crawl is live). No star pills.
- Visual: real `NoticeCard` stack with believable ordinary roles (Customer Support Specialist, Data Entry Clerk, Administrative Assistant) with varied dates, mono host, "Direct to company" highlighter, tear off tab. On 375 crop to one card plus the counter.
- Secondary action: text link "How we check every job".

## 3. Field chips
Label: "Pick your field. We'll count real matches as you answer." Chips (8, live count each): Customer support · Data entry · Admin and executive assistant · Project coordination · Sales and customer success · Operations · Finance and accounting support · Marketing coordination. Tap starts quiz (full screen, one question per screen).

## 4. Problem
H2: "Most of the job boards you scroll are showing you the wrong jobs."
Three plain blocks (asymmetric, not equal cards):
- "Since 31 March 2026, Indeed shows many jobs from company hiring systems only if the company pays." (cite Indeed policy link)
- "Staffing agencies repost the same role again and again. You apply, nobody answers." (ClearlyRated 2026: 46% ghosted by a staffing firm, link)
- "Some listings are not being filled at all. Greenhouse reported 18 to 22% of postings not actively filled (about 19% in Q2 2026)." (link). "Resume Builder, Aug 2026, n=1,011: 86% met a suspected ghost job." (link)
Margin note (Caveat, 4 words max): "Check the date." 

## 5. Tagline reveal (B11)
"Every job comes from the company's own page. / Every date is the real first posted date. / Nothing between you and the employer." Heading 3 to 1, max 680px, word by word to full colour on scroll.

## 6. How it works
1. "Pick your field" (UI: chips + counter ticking "312 matches so far").
2. "Get your matches" (UI: 5 open cards + locked rest with real titles; receipt "We removed 41 staffing agency posts from this list.").
3. "Apply at the company" (UI: tear off tab with host jobs.lever.co/acme; "Did you apply? Yes / No").
CTA repeat as text link.

## 7. On every notice (bento, varied sizes)
- Trust strip (large): "Posted 2 days ago · Never reposted · Checked 14 min ago · jobs.lever.co".
- Agency receipt: "We removed 41 staffing agency posts from this list."
- Old posting badge: "Old posting, 41 days" in marker, icon + word.
- Alerts: "Free: a daily email at 8:00. Paid: an email within the hour a new job is posted." (target median under 60 min; say "aims to" until measured: placeholder `{{measured_alert_delay}}`).
- Free tier: "5 free job opens a day. 10 saved jobs. Daily digest. No card."
- Honest line: "HiringCafe is free and has more jobs. We sell guided matching, alerts and trust signals." (brief: be honest)

## 8. Compare
Title: "Same idea as the pricier sites. About half the price." Table rows: price per month, price shown before sign up, refund window, first posted date, repost count, agency removal receipt, free tier. Columns: Straightpin by BufferSol, directroles.net, Jobright, FlexJobs, HiringCafe. Footnote with source URL and date for each: "Prices checked 3 Nov 2026." Never say rivals' jobs are fake. Facts only from brief section Competitors; unknown cells say "not stated".

## 9. Pricing
Headline "What we charge, full stop." Cards (same Y alignment): Free $0 (5 opens a day, 10 saved, daily digest) · Weekly $4.99 per week · Monthly $10.99 per month (pre selected, label "Most people pick this", it is a label not a claim, keep "Pre selected"). Lifetime line: "Lifetime $23.99 once. Core plan forever. First 1,000 buyers." Plus listed as "Plus, coming: $19.99 a month" (v1). Under buttons: "Price shown before you sign up. Cancel in two taps. Changed your mind in 7 days? Full refund. No crossed out prices, no countdowns."

## 10. FAQ (10)
1 Is this a scam? 2 Why pay to see jobs? 3 How do you remove agencies? 4 How do you verify jobs? 5 How is this different from Indeed or LinkedIn? 6 Will you apply for me, or write my resume with AI? ("No, on purpose. Real jobs, you apply as yourself.") 7 What if I forget to cancel? (renewal reminder 3 days before, two tap cancel) 8 Which countries? (US now, Canada and UK, local prices at checkout later) 9 Where do jobs come from? (employer hiring systems and careers pages; robots.txt respected; link /bot) 10 How do I get a refund? Answers use brief copy only.

## 11. Final CTA
"Pick your field. See what is open today." + same CTA and price line.

## 12. Footer
"A BufferSol product". Links: Privacy, Terms, Refund policy, Cookies (UK), About our data (O*NET credit), Crawler info (/bot), Contact. Disclaimer: "Companies shown are not affiliated with Straightpin by BufferSol. We are not a recruiter and never take a cut of your pay."

## Other marketing pages (M1 and later)
/pricing (full table, FAQ), /jobs/<role> SEO pages (H1 + live count + 20 newest notices, titles visible, links gated), /ca, /uk, /compare/<rival> (type D, dated), /about/data, /bot, legal.
