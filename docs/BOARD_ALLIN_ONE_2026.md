# Co-duck Board Session — "All-In-One Coaching Platform" Strategy

**Date:** 2026-04-16
**Convened by:** Dave (CEO, Co-duck)
**Board members (simulated):** Mark Zuckerberg (Scale & Network Effects) · Jeff Bezos (Customer Obsession & Flywheel) · Elon Musk (First Principles & 10x Simplification) · Sam Altman (AI-Native Bets)
**Inputs:** `docs/AUDIT_HW_NICHE_2026.md` (5.4/10 audit) · `CLAUDE.md` · `src/db/schema.ts` (32 tables shipped)

> **Dave's brief to the board:**
> "Co-duck scored 5.4/10 for a US Health & Wellness coach persona. Competitors are Paperbell, Practice.do, Simply.Coach. I want to leapfrog them — I want Co-duck to be THE ALL-IN-ONE platform where Sarah needs nothing else. What are we missing? What do we build? What's the sequence? And be brutal — tell me what to KILL, not just what to add."

---

## Part 1 — The Debate

### Round 1 — "What is the actual problem with Co-duck today?"

**Bezos:** Let's start with Sarah, not the product. 38 years old, Functional Medicine practitioner, $80-150 a session, 12-20 clients a month. She uses — at minimum — Calendly, Stripe, ConvertKit, Zoom, Google Drive, Notion, Voxer or Marco Polo, sometimes Paperbell or HoneyBook. That's eight tabs open at all times. The product I want her to choose is the one that closes seven of them on day one. Co-duck today closes maybe two. That's the problem.

**Zuck:** I disagree with the framing. Sarah's stack isn't the problem. The problem is **distribution**. You shipped 32 tables and a marketplace and the homepage still says "AccrediPro CoachHub" — `src/app/(public)/page.tsx:146`. You're competing with Paperbell on features and Paperbell doesn't even have a marketplace. They're SaaS-only. **That's our wedge.** No one else discovers the coach. Everyone else just bills the coach. Co-duck has the directory, the streaks, the iConnect feed. Nobody is using any of it because the front door is broken.

**Musk:** Both of you are looking at this wrong. **Why does Sarah need 28 features?** Why does she need a "session prep questionnaire table" and a "session note template table" and an "iConnect post table" and a "weekly check-in table"? Look at the schema —

<details>
<summary>32 tables</summary>

```
users, coach_profiles, coach_availability, availability_overrides,
bookings, transactions, conversations, messages, session_note_templates,
session_notes, action_items, reviews, google_calendar_tokens, notifications,
group_sessions, group_session_participants, programs, goals, attachments,
iconnect_posts, iconnect_task_items, iconnect_comments, coach_invites,
push_tokens, client_groups, client_group_members, coaching_streaks,
streak_activities, weekly_check_ins, session_prep_responses, session_prep_questions
```

</details>

That is a 2014 PHP product. Coaching is a **conversation between two humans about feeling better**. The whole thing should be one chat thread with structured memory. What if Co-duck is just a **superintelligent thread between Sarah and her client**, and everything — booking, payment, intake, notes, action items, mood — is just _messages in that thread_ parsed by AI? You don't need 32 tables. You need 4: users, conversations, messages, money. Everything else is a view.

**Altman:** Elon's right about the direction, wrong about the timing. You can't ship "AI-mediated relationship" in Q2 2026 to a Functional Medicine coach who still prints intake forms. But the _bet_ is right. The next two years, every SaaS platform that doesn't have an AI agent doing the boring work for the coach loses. Sarah spends 10 hours a week on admin. We can take 7 of those hours back with **session transcript → AI summary → auto-suggested action items → auto-drafted client follow-up email**. That alone is more valuable than packages, intake forms, and embeddable widgets combined.

**Bezos:** Sam, I love AI. But "AI summary" is a feature. **Customer trust is the moat.** The reason Sarah pays Paperbell $49/mo isn't because Paperbell is innovative. It's because Paperbell doesn't lose her client data, doesn't change pricing on her, doesn't ship breaking changes the week before her cohort launches. We have a **brand consistency bug in production right now** — the homepage literally has the wrong company name. That's not a missing feature. That's a "do you trust us with your livelihood?" failure. Fix that before any AI bet.

**Zuck:** Agreed on the brand bug — that's a 30-minute fix and it's been sitting there. But Bezos, you're going to slow-walk this into a competent niche product. Sarah doesn't matter alone. **Sarah-types referring other Sarah-types matter.** What's our viral coefficient? Zero. What's our public surface? Coach profile pages that don't even rank on Google because the taxonomy is "Health & Wellness" — one bucket — instead of `/coaches/perimenopause-coach`, `/coaches/trauma-informed-coach`. Every coach we onboard should produce 3 indexed landing pages and bring 5 organic clients in 6 months.

**Musk:** You're all defending shipping more of the same thing. I'm asking — **why is this even a web app?** The H&W coach lives on her phone. Her client lives on her phone. Why are they typing into a desktop dashboard? This should be a **voice-first iOS app** where the client says "Sarah, I'm spiraling" and the AI agent decides whether to escalate to Sarah, surface a grounding exercise, or schedule an emergency 15-minute call. The platform mediates.

**Bezos:** Elon, you're describing a 5-year product. Dave is asking about a 90-day plan to beat Paperbell. The answer to Round 1 is: **the problem with Co-duck today is that it's three products awkwardly stitched together — a marketplace, a CRM, and a community tool — and none of the three is best-in-class for Sarah.** We need to pick one to be best-in-class first.

**Zuck:** Marketplace.

**Bezos:** CRM. Sarah pays for the tool that makes her money on Tuesday morning. She doesn't pay for the tool that maybe brings her a client in 6 months.

**Altman:** Both of you are right. The marketplace is the **acquisition** moat, the CRM is the **retention** moat. The AI layer is what _makes them inseparable_ — when the AI knows everything about Sarah's clients (because it's running her CRM), the matching for new clients (the marketplace) becomes 10x better than Paperbell, who has no client data.

**Musk:** Fine. But we're still not answering Dave's question. He said "ALL-IN-ONE." That word has a meaning. It means **Sarah closes every other tab.** Round 2.

---

### Round 2 — "What does ALL-IN-ONE even mean for a Health & Wellness coach?"

**Zuck:** Let's enumerate. Sarah's stack today, by category:

1. **Booking** — Calendly or Acuity
2. **Payments** — Stripe direct + Venmo for sliding scale
3. **Packages** — Paperbell or ThriveCart
4. **Contracts/waivers** — HoneyBook
5. **Intake forms** — Typeform or JotForm
6. **Video** — Zoom Pro
7. **Async messaging** — Voxer (this is huge for H&W — short voice notes between sessions)
8. **Notes** — Notion or Google Docs
9. **Client CRM** — also Notion, sometimes Dubsado
10. **Email marketing** — ConvertKit or Flodesk
11. **Content/courses** — Kajabi or Teachable
12. **Community** — Circle or Mighty Networks or a private Facebook group
13. **Mood/symptom tracking** — Oura, Clue, or paper journal
14. **Lab results** — emailed PDFs, Dropbox
15. **Website** — Squarespace or Wix
16. **Social scheduling** — Later or Buffer
17. **Testimonial collection** — Senja or Testimonial.to
18. **Referrals** — manual word-of-mouth
19. **Analytics** — Google Analytics + Stripe dashboard
20. **Tax/accounting** — QuickBooks
21. **AI** — ChatGPT for content + Otter for note transcripts
22. **File storage** — Google Drive

That's 22 tools. Co-duck today replaces — generously — booking, payments, messaging, basic notes, basic CRM. That's 5/22. **We're at 22% all-in-one.**

**Bezos:** Let's not chase 22/22. Let's pick the **top friction tools** Sarah actively complains about. From customer interviews in this niche the top complaints are:

- "I'm tired of stitching Stripe + Calendly + my intake form together — when one breaks, the booking flow breaks." (Booking + Payment + Intake — we partially have this)
- "Voxer for async voice between sessions, but it's not connected to my notes about that client." (Voice + CRM)
- "I have a 12-week program but no platform sells multi-session packages well." (Packages — gap)
- "Email sequences in ConvertKit are decoupled from my client database." (Email automation)
- "I want a private membership circle for my menopause clients but Circle costs $99/mo and is overkill." (Community + group sessions)

Five clear bundles. Hit those five and Sarah's at 80% all-in.

**Altman:** Add a sixth: "ChatGPT is now writing all my client follow-ups, my Instagram captions, and my newsletter — but it doesn't know my clients." **Native AI with full client context** is the differentiator no incumbent can copy in 12 months because they don't have the data model. Co-duck's 32 tables are actually a _gift_ for Sam Altman's argument — **we have the substrate AI needs.**

**Musk:** Counterpoint — if we have 32 tables and 22% coverage, the marginal cost of each new feature is enormous. Look at iConnect (`schema.ts:2402-2540`) — three tables, posts/tasks/comments. What does it actually do that the messages table doesn't? Why is `weekly_check_ins` (`schema.ts:3172`) a separate table from messages with `messageType: 'check_in'`? **We have schema sprawl, not feature depth.** Before we add Voxer-killer + Kajabi-killer + Circle-killer, kill the dead weight.

**Zuck:** I'm with Elon on the kill list. But Sam's point about AI-as-substrate is the sharpest thing said in this room. Here's the synthesis: **Co-duck's all-in-one play is "the AI-native coaching CRM with a marketplace front door."** Booking, packages, intake, video, async voice, notes, email — these are _table stakes_ for ALL-IN-ONE. The **moat** is the AI agent that lives on top of all that data and does Sarah's admin while she sleeps.

**Bezos:** Define "all-in-one" operationally for the deliverable: **Sarah can close Calendly, Stripe Checkout, Typeform, Zoom, Voxer, Notion, ConvertKit, Senja, and Circle within 90 days of switching to Co-duck.** Nine tabs closed. That's the goal post.

**Musk:** And Kajabi? Squarespace?

**Bezos:** Year 2. Kajabi is a content product with a different mental model — selling courses to a list. We should not pretend to replace it in 90 days. Squarespace is her brand. We embed _into_ Squarespace, we don't replace it. That's Zuck's embeddable widget point.

**Zuck:** OK. So Round 2 verdict: **all-in-one means 9 specific tools closed in 90 days, plus an AI layer no competitor has, plus a marketplace front door no SaaS competitor has.**

**Altman:** Add: "and the data ownership story is bulletproof — coach owns her client data, can export it, can delete it, can take it with her." That's the trust precondition for everything else.

**Musk:** Round 3. What do we kill?

---

### Round 3 — "What do we KILL?"

**Musk:** I'll start because I have the longest list. **iConnect.** Three tables (`iconnect_posts`, `iconnect_task_items`, `iconnect_comments` — `schema.ts:2402-2540`). It's a Slack-for-one-client. Nobody asked for it. Sarah uses Voxer because it's voice. Clients use iMessage because it's iMessage. We built a third thing that's neither. **Fold it into the messages table** with `messageType: 'task' | 'image' | 'voice'`. Save 800 lines of code.

**Bezos:** Cautious agree. iConnect's _intent_ — a structured workspace per client — is right. Its _execution_ as a separate primitive is wrong. Make the conversation thread the workspace. Pin tasks. Pin files. One thread, infinite affordances.

**Zuck:** Kill #2: **the `coach_invites` table** (`schema.ts:2548`) if it's just for inviting other coaches manually. We need a real referral product, not a manual invite link.

**Musk:** Kill #3: **the entire `session_prep_questions` + `session_prep_responses` tables** (`schema.ts:3245-3335`) as a separate primitive. This is just an intake form. Build ONE form-builder primitive (`forms` + `form_responses`) and use it for: intake forms, session prep, post-session check-in, contract waivers, NPS surveys, testimonial requests. Today we have _zero_ form builder and _one_ hardcoded session-prep schema. That's backwards.

**Altman:** Kill #4: **the corporate "executive coach" copy across the marketing surface.** Specifically `(public)/page.tsx`, `(public)/about/page.tsx`, `(public)/specialties/page.tsx`. The audit calls this out. Sarah looks at "Transform Your Life — Trusted by 1,000+ executives" and bounces. Either rebuild for the H&W niche or — Zuck's call — go dual-vertical with a route-based theme switch. But the current copy must die.

**Zuck:** Counterpoint to Sam's "dual vertical" — no. Pick one vertical. We're at 5.4/10 because we tried to be everyone's coach. **Be the H&W platform.** Career and exec coaches can come back when we've won this niche.

**Bezos:** Agreed. Kill #5: **the generic `COACH_SPECIALTIES` constant of 12 buckets** (`coach-onboarding.ts:133-146`). Replace with a 2-level taxonomy where H&W has 15 sub-niches and the others are coarse. This is the SEO unlock.

**Musk:** Kill #6: **the 4-step coach onboarding wizard.** It's 4 forms over 4 pages and Sarah's drop-off has to be brutal. Make it ONE page that auto-saves, with smart defaults filled in by AI from her LinkedIn URL. "Paste your LinkedIn, paste your Instagram, we draft the whole profile in 30 seconds, you edit." Ship the same data, 80% less friction.

**Altman:** That's an AI feature — agreed, but tag it as build, not kill.

**Musk:** Fair. Then Kill #7: **the assumption that Stripe's 2.9% + 10% platform fee is the right business model.** A Functional Medicine coach charging $150/session and doing 60 sessions/month grosses $9,000. We take $900. Paperbell takes $49 flat. **We're 18x more expensive than Paperbell at scale.** Move to a tiered SaaS model — $49/mo flat or 5% capped at $99 — pick whichever is lower. 10% scales us out of the market when she succeeds. We should _want_ her to succeed.

**Bezos:** Strong agree. Pricing model is a strategic kill. The 10% destination charge made sense as a marketplace v1 because it's frictionless. But we're not just a marketplace — we're SaaS now. Hybrid: free directory listing + 10% on marketplace-originated bookings, $39/mo or $79/mo for SaaS features (her own clients, packages, AI, no fee).

**Zuck:** That's a real pricing strategy. Add Kill #8: **the dependency on Google Calendar OAuth as the only calendar sync.** Apple Calendar, Outlook, iCloud. Marketplaces lose to "I just sync to my actual calendar" friction every day.

**Musk:** That's a build, not kill. Stay focused.

**Zuck:** Fair.

**Bezos:** Round 3 verdict — kill list:

1. iConnect tables → fold into messages
2. Manual coach_invites → real referral product
3. Session_prep_questions tables → generalize to forms primitive
4. "AccrediPro CoachHub" + executive-coach copy → niche-native rebuild
5. COACH_SPECIALTIES 12-bucket taxonomy → 2-level tree
6. 4-step onboarding wizard → 1-page AI-assisted onboarding
7. 10% blanket fee → tiered SaaS + lower marketplace fee

Seven kills. Now Round 4 — what do we build?

---

### Round 4 — "What do we BUILD to be the end-of-stack choice?"

**Bezos:** Order of operations, not order of glamor. Sarah's daily pain stack determines build order. Start with the thing she opens at 9am Monday.

**Musk:** Which is what?

**Bezos:** Her calendar to see today's clients. Today she opens Calendly _and_ Co-duck _and_ her notes app. We need to be the only tab. So:

1. **Embeddable booking widget** — she pastes one snippet on Squarespace and Calendly is gone. (Audit P1 #10.)
2. **Packages** — multi-session bundles with Stripe Checkout. (Audit P0 #3.) Without this Paperbell wins on day one.
3. **Custom intake form builder** (per Musk's "one form primitive"). (Audit P0 #4.)
4. **Memberships / recurring subscriptions** — Stripe Subscriptions wired in. (Audit P1 #9.)
5. **Email sequences** — welcome, pre-session prep, post-session follow-up, 30-day re-engagement. Resend templates already exist (`src/lib/emails/`). (Audit P1 #11.)

That's the table-stakes block. ~6-8 weeks of focused engineering.

**Altman:** Now my AI block, also 6-8 weeks but parallelizable:

1. **AI coach onboarding** — paste LinkedIn URL → draft profile, headline, bio, specialties. Reduce 4-step wizard to 1 step.
2. **AI session notes** — coach uploads recording or transcript (or we record in-app), AI generates: 1-paragraph summary, 3-5 action items, suggested follow-up email, suggested next session prep. This alone is the killer feature.
3. **AI intake summary** — when client fills the intake form, AI gives Sarah a 3-bullet pre-session brief. Audit P2 #24.
4. **AI matching** — client describes "I'm 42, perimenopause, anxious, prefer trauma-informed, budget $150/session" → AI ranks coaches and explains why. Marketplace becomes 10x better than browsing tiles.
5. **AI content repurposing** — session highlight (with consent) → social post draft, newsletter excerpt. Replaces ChatGPT-for-content workflow.

**Zuck:** My growth block:

1. **Sub-specialty taxonomy + SEO landing pages** — one per sub-niche. `/coaches/perimenopause-coach`, `/coaches/trauma-informed-coach`, etc. 15 pages on day one, compound for 12 months.
2. **Embeddable booking widget** (overlap with Bezos — confirmed P0).
3. **Referral program** — client invites friend → both get $20. Coach invites coach → coach earns 10% of invitee's first 6 months SaaS fee.
4. **Public testimonial product** — auto-request post-session, surface as carousel on coach profile + as widget she can embed.
5. **Coach profile becomes a real landing page** — replace `/coaches/[slug]` minimal page with a Linktree-quality landing page Sarah can use as her sole IG bio link. Replaces Linktree + Squarespace lite.

**Musk:** My simplification block:

1. **Forms primitive** (kills `session_prep_questions` and the future Typeform need).
2. **Folding iConnect into messages.**
3. **Onboarding wizard collapse to 1 page.**
4. **Pricing model overhaul — tiered SaaS + lower marketplace fee.**
5. **Mobile-first UX redesign** — dashboard that works thumbs-only.

**Altman:** I want to add the moonshot bets too — these aren't 90-day, they're the why-Co-duck-wins bets:

- **Voice-first AI coach companion (mobile)** — async voice notes Sarah records that her clients can listen to, AI transcribes and tags. Voxer killer + Otter killer.
- **AI coach twin** — between sessions, client can chat with an AI persona trained on Sarah's voice and notes (with Sarah's consent and pricing). Async between-session support that scales Sarah's hours without scaling her hours.
- **HIPAA / BAA tier** — for the slice of H&W who actually need it (RDs, LCSWs, therapists who coach on the side). $199/mo enterprise tier.
- **B2B2C / Corporate Wellness** — sell Co-duck to companies for employee wellness. White-label tier.

**Bezos:** Sam, all four are good but only one ships in year one. AI coach twin is the moat. HIPAA is a niche-within-the-niche. Corporate is a different sales motion. Pick.

**Altman:** AI coach twin. Year 2.

**Zuck:** I want to push back on the AI twin. Coaching is a relationship, and an AI persona of the coach risks brand damage when it gives bad advice. **Bezos was right — AI is a feature, trust is the moat.** I'd build AI in service of the coach (notes, drafting, summaries) and not as a replacement for the coach. That's the Sam-Bezos synthesis.

**Altman:** Fine — frame it as **"Sarah's AI assistant"** rather than "Sarah's AI twin." Same product, less liability framing. "Powered by your coach, not replacing them."

**Musk:** Last build I want on the table: **kill the web-first paradigm.** Co-duck native iOS app, Q3 2026. Push notifications schema (`pushTokens`, `schema.ts:2581`) is already there — we have a mobile team flagged in CLAUDE.md (`pm-co-duck-mobile`). That's the platform Sarah's clients live on. It's also the moat against Paperbell, which is web-only.

**Bezos:** Approved as a year-1 ship, not 90-day.

**Zuck:** Round 4 closed. Round 5 — sequence.

---

### Round 5 — "Sequence: 90 days, 12 months, 3 years"

**Bezos:** 90 days has to be: **(a) fix the brand bug, (b) ship packages + intake forms + memberships, (c) pricing model overhaul, (d) one AI win.** That's the minimum viable "Sarah switches from Paperbell" product.

**Musk:** Add: ship the schema simplification (forms primitive + iConnect collapse). Otherwise we're paying for 32 tables forever.

**Zuck:** Add: ship the SEO unlock (sub-specialty taxonomy + landing pages). The flywheel needs to start spinning in 90 days, not 12 months.

**Altman:** The "one AI win" should be **AI session notes** — biggest pain killer for Sarah's daily admin. We can ship this in 4 weeks if we use Whisper + GPT-4o + a good prompt. No need to build models.

**Bezos:** Agreed. 90-day list:

**Block A — Trust & Brand (Week 1-2):**

1. Fix "AccrediPro CoachHub" homepage. New niche-native hero. (Audit P0 #5.) — S
2. HIPAA-adjacent privacy pack — rewrite `/privacy`, microcopy on intake/messaging. (Audit P0 #6.) — S
3. Credentials field on coach profile. (Audit P0 #1.) — M

**Block B — Discovery (Week 2-4):** 4. Sub-specialty taxonomy + SEO landing pages. (Audit P0 #2 + P1 #17.) — M 5. Credential-verified badge tier. (Audit P0 #8.) — S 6. Free Discovery Call as primary CTA. (Audit P0 #7.) — S

**Block C — Monetization (Week 3-7):** 7. Packages (multi-session bundles). (Audit P0 #3.) — L 8. Memberships / recurring subscriptions. (Audit P1 #9.) — L 9. Pricing model overhaul: tiered SaaS + reduced marketplace fee. — M

**Block D — Platform Primitives (Week 4-9):** 10. Forms primitive (replaces session_prep_questions + enables intake forms + waivers + post-session check-ins + NPS). — L 11. Custom Intake Form Builder (uses forms primitive). (Audit P0 #4.) — M (after #10) 12. iConnect collapse into messages with `messageType` extensions. — M

**Block E — AI Wedge (Week 5-10):** 13. AI session notes (transcript → summary + action items + draft follow-up). (Audit P2 #20.) — L 14. AI coach onboarding (LinkedIn URL → draft profile). — M

**Block F — Distribution (Week 8-12):** 15. Embeddable booking widget. (Audit P1 #10.) — M 16. Email sequences (welcome / prep / follow-up / re-engagement). (Audit P1 #11.) — M 17. Testimonial request flow. (Audit P1 #12.) — M

That's 17 ships in 90 days across 4 parallel tracks. Aggressive but doable with Caesar's decomposition.

**Musk:** I'd cut at 12. You can't ship 17 things in 90 days with quality. Drop email sequences (Resend cron is enough for v1), drop testimonial flow (manual ask-for-review email is enough for v1), drop credential-verified badge (just ship the credentials field, badge is week 13). Make the cut: **12 ships in 90 days.**

**Zuck:** Fine — 12. But keep the embeddable widget. That's the distribution unlock.

**Bezos:** OK. **12-month horizon** beyond the 90-day:

- AI matching (client → coach)
- AI intake summary
- AI content repurposing
- Apple/Outlook calendar sync
- Sliding scale + coupon codes
- Client mood/sleep/symptom tracker (extend `weekly_check_ins`)
- Wellness exercise library (coach-curated, attached to action items)
- Group coaching circles (extend `group_sessions` with recurrence + anonymous Q&A)
- Refund/cancellation policy per coach
- Branded subdomain per coach (`sarah.coduck.com`)
- Mobile app (iOS first, push schema is ready)
- Voxer-style async voice in messages

**Altman:** **3-year moonshots:**

- Sarah's AI Assistant (between-session AI for clients, with coach approval and pricing)
- Voice-first mobile UX (whisper + speak instead of type)
- HIPAA / BAA enterprise tier ($199/mo) for licensed practitioners
- B2B2C corporate wellness channel (sell Co-duck to companies)
- Marketplace 2-sided network (clients refer clients; coaches refer coaches)
- International expansion (UK first — same English copy, similar coaching market, no regulatory cliff)
- API + plugin ecosystem (Zuck's network-effect bet — but only AFTER we've earned product-market fit)
- Co-duck Health (data partnerships — Oura, Whoop, Apple Health — pulls into client tracker)

**Zuck:** Add: **public coach reputation API** so wellness directories, podcast guests, IG profiles all link back to Co-duck-verified credentials. We become the LinkedIn of credentialed wellness coaches.

**Musk:** Add: **agentic operations** — by year 3, Sarah's AI assistant doesn't just summarize, it **executes** — books her clients' next sessions, drafts and sends follow-ups, flags at-risk clients, drafts her next month's IG content from session themes. The platform earns its keep by replacing her VA.

**Bezos:** All accepted. Final verdict in Part 6.

---

## Part 2 — The Complete ALL-IN-ONE Feature Map

| Tool Sarah uses today                        | What it does                                | Co-duck replacement                                                                                                                          | Status                             |
| -------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Calendly / Acuity**                        | Booking + availability + buffers + timezone | Booking flow + `coach_availability` + `availability_overrides` (`schema.ts:770, 871`)                                                        | ✅ Shipped                         |
| **Stripe Checkout (direct)**                 | Per-session payment                         | Stripe Connect destination charges (`src/lib/stripe.ts`)                                                                                     | ✅ Shipped                         |
| **Venmo / PayPal (sliding scale)**           | Off-platform discount payments              | Coupons / promo codes / sliding scale field on coach profile                                                                                 | ❌ P1                              |
| **Paperbell / ThriveCart**                   | Multi-session packages, one-time payment    | `coach_packages` table + Stripe Checkout for bundle                                                                                          | ❌ P0                              |
| **Stripe Subscriptions**                     | Monthly retainer model                      | Memberships table + Stripe Subscriptions integration                                                                                         | ❌ P0                              |
| **HoneyBook / Dubsado (contracts)**          | Client agreements, e-signature              | Contract waiver as a Form type with consent checkbox + audit log                                                                             | ❌ P1                              |
| **Typeform / JotForm / Google Forms**        | Custom intake forms                         | Forms primitive (generalized from `session_prep_questions`) + Intake Form Builder                                                            | 🟡 Partial → P0                    |
| **Zoom / Google Meet**                       | Video calls                                 | `bookings.meetingLink` is just a URL today (`schema.ts:991`)                                                                                 | 🟡 Link-only — P1 in-app           |
| **Voxer / Marco Polo**                       | Async voice notes between sessions          | Messages table + voice message type (`messageType: 'voice'`)                                                                                 | ❌ P1                              |
| **Notion / Evernote / Google Docs**          | Session notes                               | `session_notes` + `session_note_templates` (`schema.ts:1509, 1563`)                                                                          | ✅ Shipped                         |
| **Dubsado / HoneyBook (CRM)**                | Client pipeline, tags, lifecycle            | `client_groups` + `client_group_members` (`schema.ts:2935, 2982`) — needs pipeline stages + tags                                             | 🟡 Partial — P1                    |
| **ConvertKit / Mailchimp / Flodesk**         | Email marketing sequences                   | Resend templates exist (`src/lib/emails/`); needs sequence engine                                                                            | 🟡 Cron only — P0                  |
| **Kajabi / Teachable / Thinkific**           | Async courses + content                     | Programs + Goals + Attachments (`schema.ts:2180, 2253, 2335`) — needs lesson/module structure                                                | 🟡 Partial — P2                    |
| **Circle / Mighty Networks / FB Groups**     | Community / membership feed                 | `group_sessions` + recurrence + anonymous Q&A                                                                                                | 🟡 Partial — P1                    |
| **Zoom + Eventbrite + spreadsheet (groups)** | Group coaching workshops                    | `group_sessions` + `group_session_participants` (`schema.ts:2045, 2117`)                                                                     | ✅ Shipped (needs polish)          |
| **Oura / Clue / paper journal**              | Mood, sleep, energy, cycle tracking         | `weekly_check_ins` (`schema.ts:3172`) → extend to `daily_metrics` table                                                                      | 🟡 Partial — P1                    |
| **Email / Dropbox (lab results)**            | Send PDFs to coach                          | `attachments` (`schema.ts:2335`) + new `attachment_type: 'lab_result'` + coach annotation UI                                                 | 🟡 Partial — P1                    |
| **Squarespace / Wix / Linktree**             | Coach's website + bio link                  | Coach profile becomes Linktree-quality landing page; embeddable booking widget for full sites                                                | 🟡 Partial — P0                    |
| **Later / Buffer / Planoly**                 | Social media scheduling                     | AI content repurposing (session theme → social post draft)                                                                                   | ❌ P2                              |
| **Senja / Testimonial.to**                   | Testimonial collection + display            | Reviews table (`schema.ts:1778`) + auto-request flow + embeddable widget                                                                     | 🟡 Partial — P1                    |
| **Manual referrals / Rewardful**             | Client + coach referrals                    | Referral program: client → friend ($20 credit), coach → coach (% of SaaS fee)                                                                | ❌ P1                              |
| **Google Analytics / Stripe dashboard**      | Coach business analytics                    | Coach analytics dashboard: bookings, revenue, retention, NPS, at-risk clients (`coaching_streaks` already tracks at-risk — `schema.ts:3053`) | 🟡 Partial — P1                    |
| **QuickBooks / Xero**                        | Tax + accounting                            | Annual 1099-style export from `transactions` table; integration link to QBO                                                                  | ❌ P2                              |
| **ChatGPT (content)**                        | Drafts emails, captions, newsletters        | AI content repurposing + AI follow-up drafts                                                                                                 | ❌ P0 (one AI win)                 |
| **Otter.ai (transcripts)**                   | Session recording + transcript              | AI session notes (record in-app or upload → transcript + summary + action items)                                                             | ❌ P0 (THE killer feature)         |
| **Google Drive / Dropbox**                   | Client file storage                         | `attachments` (`schema.ts:2335`) — already exists; just needs UI polish                                                                      | ✅ Shipped                         |
| **Multiple coaches / VA**                    | Hire associate or VA                        | Multi-coach teams + view-only admin role                                                                                                     | ❌ P2                              |
| **Apple Calendar / Outlook**                 | Personal calendar sync                      | Today only Google (`google_calendar_tokens`, `schema.ts:1885`); add Apple/Outlook                                                            | ❌ P1                              |
| **Crisis hotline / safety net**              | 988, Crisis Text Line                       | Crisis resource footer on every client dashboard                                                                                             | ❌ P0 (S complexity)               |
| **Push notifications**                       | Mobile reminders                            | `push_tokens` table exists (`schema.ts:2581`) — needs mobile app to consume                                                                  | 🟡 Schema-ready — P1 (with mobile) |

**Coverage today:** 5/29 fully shipped, 11/29 partial, 13/29 missing. **Co-duck closes ~24% of Sarah's stack today. Goal: 75% in 90 days, 90% in 12 months.**

---

## Part 3 — What to KILL (Musk's List, Board-Approved)

| #   | Kill                                                                                                        | Why                                                                                                                                                                          | Files / Tables                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | **iConnect as separate primitive** — fold into messages                                                     | Three tables for what is functionally a richer message type. Schema sprawl with no UX advantage over a thread with pinning + tasks.                                          | `iconnect_posts`, `iconnect_task_items`, `iconnect_comments` (`schema.ts:2402-2540`)                            |
| 2   | **`session_prep_questions` + `session_prep_responses` as bespoke schema** — generalize to a Forms primitive | One forms primitive serves intake + waivers + session prep + NPS + post-session check-ins + testimonial requests. Today we have one hardcoded form pattern and zero builder. | `session_prep_questions`, `session_prep_responses` (`schema.ts:3245-3335`)                                      |
| 3   | **"AccrediPro CoachHub" homepage copy + executive-coach positioning**                                       | Brand inconsistency bug + wrong persona. Sarah bounces in 10 seconds.                                                                                                        | `src/app/(public)/page.tsx:104-146`, `src/app/(public)/about/page.tsx`, `src/app/(public)/specialties/page.tsx` |
| 4   | **12-bucket `COACH_SPECIALTIES` taxonomy**                                                                  | "Health & Wellness" as one tile is the SEO + discovery bottleneck. Replace with 2-level tree with 15 H&W sub-niches.                                                         | `src/lib/validators/coach-onboarding.ts:133-146`                                                                |
| 5   | **4-step coach onboarding wizard**                                                                          | High friction, high drop-off. Replace with 1-page AI-assisted onboarding (paste LinkedIn → draft profile).                                                                   | `src/app/(dashboard)/onboarding/coach/*.tsx` (4 pages)                                                          |
| 6   | **Blanket 10% platform fee**                                                                                | Makes us 18x more expensive than Paperbell at scale. Move to tiered SaaS ($39 / $79) + reduced fee on marketplace-originated bookings only.                                  | `src/lib/stripe.ts` (fee calc), pricing page, transaction model                                                 |
| 7   | **`coach_invites` as the only invite mechanism**                                                            | Manual one-off links don't drive growth. Replace with a real referral product (client→friend credit + coach→coach revenue share).                                            | `coach_invites` (`schema.ts:2548`)                                                                              |

**Net effect:** ~3 tables removed, ~1500 lines of code deleted, schema simpler, brand consistent, pricing competitive, onboarding faster, taxonomy SEO-ready. **Subtraction is a feature.**

---

## Part 4 — What to BUILD (Converged Roadmap)

### 90-Day Sprint (Q3 2026 — 12 ships, 4 parallel tracks)

| #   | Feature                                                                                                                   | Champion | Rationale                                                                      | Complexity | Discipline                      |
| --- | ------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------ | :--------: | ------------------------------- |
| 1   | **Brand fix + niche-native homepage** (kill "AccrediPro", new H1, 8 specialty tiles, credential trust strip)              | Bezos    | Trust precondition. Every dollar of paid traffic leaks until this is fixed.    |     S      | Frontend + Design               |
| 2   | **HIPAA-adjacent privacy pack** (rewrite `/privacy`, microcopy, "not medical advice" disclaimers, crisis resource footer) | Bezos    | Disqualifying gap for H&W buyers. Quick win.                                   |     S      | Frontend + Legal copy           |
| 3   | **Credentials field on coach profile** (JSONB: body, credential, year, verification URL)                                  | Bezos    | Sarah's #1 trust signal. Justifies $150/session.                               |     M      | Backend + Frontend + Onboarding |
| 4   | **Sub-specialty taxonomy (2-level tree)** + 15 SEO landing pages for H&W sub-niches                                       | Zuck     | SEO + discovery unlock. Compounds for 12 months.                               |     M      | Backend + Frontend + Content    |
| 5   | **Packages (multi-session bundles)** + Stripe Checkout for one-time bundle purchase + remaining-sessions UI               | Bezos    | The #1 revenue feature. Closes Paperbell.                                      |     L      | Backend + Frontend + Stripe     |
| 6   | **Memberships / recurring subscriptions** (Stripe Subscriptions)                                                          | Bezos    | Predictable revenue + retention. Grief / long-term H&W requires it.            |     L      | Backend + Stripe                |
| 7   | **Pricing model overhaul** — Free directory + tiered SaaS ($39 starter, $79 pro) + reduced marketplace fee (5% capped)    | Musk     | We're 18x more expensive than Paperbell at scale. Fix before scaling.          |     M      | Backend + Pricing page          |
| 8   | **Forms primitive** (replaces `session_prep_questions`; enables intake, waivers, post-session, NPS, testimonial)          | Musk     | Foundational. One primitive, six use cases.                                    |     L      | Backend + Frontend              |
| 9   | **Custom Intake Form Builder** (uses Forms primitive) — required first-booking with consent + scope-of-practice           | Bezos    | Mandatory for H&W coaches. Cannot legally take a client without it.            |     M      | Frontend (after #8)             |
| 10  | **AI session notes** (record/upload → Whisper transcript → GPT-4o summary + action items + draft follow-up email)         | Altman   | THE killer feature. Saves Sarah 7+ hours/week of admin.                        |     L      | Backend + AI                    |
| 11  | **AI coach onboarding** (paste LinkedIn → draft profile, headline, bio, specialties; coach edits)                         | Altman   | Collapses 4-step wizard to 1 step. Onboarding conversion 2-3x.                 |     M      | Backend + AI + Frontend         |
| 12  | **Embeddable booking widget** (`<script>` tag for Squarespace/WordPress/Linktree)                                         | Zuck     | Sarah won't switch unless we slot into her existing site. Distribution unlock. |     M      | Frontend + Backend              |

**Cuts the board explicitly chose to defer (Musk insisted on 12, not 17):** email sequence engine (cron is enough for v1), testimonial automation (manual ask is enough for v1), credential-verified badge tier (ship the field first, badge in Q4), iConnect collapse (refactor in Q4 once Forms primitive lands).

---

### 12-Month Horizon (Q4 2026 → Q2 2027)

| #   | Feature                                                                                                              | Champion | Rationale                                                                  | Complexity |
| --- | -------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------- | :--------: |
| 13  | **iConnect → messages collapse** (Musk's kill #1, deferred from Q3)                                                  | Musk     | Pay down schema debt before mobile app scales it.                          |     M      |
| 14  | **Email sequence engine** (welcome / pre-session prep / post-session follow-up / 30-day re-engagement / anniversary) | Bezos    | Replaces ConvertKit. Retention multiplier.                                 |     M      |
| 15  | **Testimonial request automation + embeddable widget**                                                               | Zuck     | Reviews compound; H&W buyers buy on stories, not features.                 |     M      |
| 16  | **AI matching** — client describes need → ranked coach list with explanations                                        | Altman   | Marketplace becomes 10x better than browsing tiles. Defensive moat.        |     L      |
| 17  | **AI intake summary** — coach gets 3-bullet pre-session brief from intake form                                       | Altman   | Sarah "gets" each client in 30 seconds.                                    |     M      |
| 18  | **AI content repurposing** — session theme → social post / newsletter draft (with coach approval)                    | Altman   | Closes the ChatGPT-for-content tab.                                        |     M      |
| 19  | **Apple Calendar + Outlook sync**                                                                                    | Zuck     | Today Google-only. Loses 40% of Sarah's prospects.                         |     M      |
| 20  | **Voxer-style async voice in messages** (`messageType: 'voice'`)                                                     | Zuck     | Voxer is the #2 most-cited tool in H&W. Closing this tab is huge.          |     M      |
| 21  | **Sliding scale + coupon codes / promo codes**                                                                       | Bezos    | Industry-standard equity pricing + paid-ad funnel enabler.                 |     M      |
| 22  | **Client self-tracking dashboard** (mood / sleep / energy / cycle — daily, optional per coach)                       | Bezos    | Functional Medicine + Hormone niche expects this. Oura-Ring-lite.          |     L      |
| 23  | **Wellness exercise library** (coach-curated video/audio attached to action items)                                   | Altman   | Somatic/trauma-informed coaches live on this.                              |     M      |
| 24  | **Group coaching circles** (recurring, anonymous Q&A, age-gated tracks)                                              | Zuck     | Menopause/grief coaches earn more from circles than 1:1.                   |     L      |
| 25  | **Refund/cancellation policy per coach** (configurable + enforced at API)                                            | Bezos    | Reduces support load + anxiety-selling for both sides.                     |     M      |
| 26  | **Branded subdomain per coach** (`sarah.coduck.com`) — premium SaaS tier                                             | Zuck     | Premium-tier upsell + competitive moat vs Practice.do.                     |     L      |
| 27  | **Mobile app (iOS first)** — consume existing `push_tokens` schema                                                   | Musk     | H&W clients are on phones. Push schema (`schema.ts:2581`) is ready.        |     L      |
| 28  | **Lab result upload + coach annotation** (extend `attachments` with `attachment_type: 'lab_result'`)                 | Bezos    | Functional Medicine niche must-have.                                       |     M      |
| 29  | **Coach analytics dashboard** (bookings / revenue / retention / NPS / at-risk clients)                               | Bezos    | Replaces Stripe dashboard + spreadsheets.                                  |     M      |
| 30  | **Trauma-informed UX pack** (compassionate copy, low-stimulation toggle, "pause session" button)                     | Bezos    | Differentiator for trauma-informed niche. Code is small; copy is the work. |     S      |

---

### 3-Year Moonshots (2027-2029)

| #   | Bet                                                                                                                                 | Champion      | Why                                                                                                     | Risk                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 31  | **Sarah's AI Assistant** (between-session AI chat for clients, trained on coach's voice/notes, with coach approval + revenue share) | Altman        | Scales coach hours without scaling coach hours. Defensible moat — needs the data substrate Co-duck has. | Liability if AI misadvises. Frame as "powered by your coach", strict guardrails, coach reviews all conversations weekly. |
| 32  | **Voice-first mobile UX**                                                                                                           | Musk          | Whisper + speak instead of type. The H&W client doesn't want to type at 11pm spiraling.                 | UX research-heavy. Bet on Apple's on-device speech-to-text quality maturing.                                             |
| 33  | **HIPAA / BAA enterprise tier ($199/mo)**                                                                                           | Bezos         | Captures the LCSW/RD/therapist-who-coaches slice. High-value, low-volume.                               | Compliance burden. Hire a compliance lead first.                                                                         |
| 34  | **B2B2C corporate wellness**                                                                                                        | Zuck          | Sell Co-duck to companies for employee mental wellness benefits. Different sales motion entirely.       | Distracts from B2C focus. Spin out as separate sales team in year 2-3.                                                   |
| 35  | **API + plugin ecosystem** (Zapier app, Zoom embed, Oura/Whoop/Apple Health pull-in)                                                | Zuck          | Network effects + integrations moat. Per Bezos: only AFTER PMF.                                         | Premature opens up trust attack surface. Year 3, not year 1.                                                             |
| 36  | **Public coach reputation API** — Co-duck-verified credentials surface on IG, podcasts, wellness directories                        | Zuck          | Become the LinkedIn of credentialed wellness coaches.                                                   | Requires trust + scale before partners care.                                                                             |
| 37  | **International expansion (UK first)**                                                                                              | Bezos         | Same English copy, similar coaching market, no regulatory cliff. Then Australia, Canada.                | EU/GDPR adds compliance load. Save EU for year 3.                                                                        |
| 38  | **Agentic operations** — AI VA that books, drafts, sends, flags at-risk on Sarah's behalf                                           | Musk + Altman | Replace Sarah's $25/hr VA. Pricing unlock — Co-duck saves her $400/mo, charges her $99/mo more.         | Tooling/agent maturity needs to catch up. Q4 2027 earliest.                                                              |

---

## Part 5 — The Sequenced 90-Day Plan (CEO-Ready)

```
WEEK 1-2   ──  FOUNDATION (parallel)
            ├─ Brand fix + new homepage hero        [Frontend, Design]      [#1]
            ├─ HIPAA-adjacent privacy pack          [Frontend, Legal copy]  [#2]
            └─ Pricing model decision + page        [Backend, Pricing]      [#7 design]

WEEK 3-4   ──  TRUST SIGNALS (parallel)
            ├─ Credentials field + onboarding step  [Backend, Frontend]     [#3]
            ├─ Sub-specialty taxonomy + 15 LP       [Backend, Content]      [#4]
            └─ Pricing model: implementation        [Backend]               [#7]

WEEK 5-6   ──  MONETIZATION CORE
            ├─ Packages (DB + Stripe Checkout)      [Backend, Stripe]       [#5]
            ├─ Forms primitive (DB + builder UI)    [Backend, Frontend]     [#8]
            └─ AI session notes: prototype          [Backend, AI]           [#10 v0]

WEEK 7-8   ──  MONETIZATION DEPTH + AI WEDGE
            ├─ Memberships (Stripe Subscriptions)   [Backend, Stripe]       [#6]
            ├─ Custom Intake Form Builder           [Frontend]              [#9]
            └─ AI session notes: ship + prompt opt  [Backend, AI]           [#10 v1]

WEEK 9-10  ──  AI ONBOARDING + BETA POLISH
            ├─ AI coach onboarding (LinkedIn→bio)   [Backend, AI, Frontend] [#11]
            ├─ Embeddable widget: build             [Frontend]              [#12]
            └─ Beta cohort: 10 founding coaches     [Sales, Success]

WEEK 11-12 ──  DISTRIBUTION + LAUNCH
            ├─ Embeddable widget: ship              [Frontend]              [#12]
            ├─ Founding coach profiles live         [Content, Design]
            ├─ SEO landing pages indexed            [Content, SEO]
            ├─ Press / Product Hunt / podcast tour  [Marketing]
            └─ Public launch: "Co-duck for H&W"     [All]
```

**Resource model (recommended):** 4 engineers (2 FE / 2 BE) + 1 designer + 1 AI engineer + 1 product/PM + 1 content/SEO. 90 days.

**Critical path:** #8 Forms primitive → #9 Intake Form Builder. #5 Packages and #6 Memberships gate revenue. #10 AI session notes is the biggest WOW; ship it visible.

**Beta strategy (Week 9-12):** Hand-recruit 10 H&W founding coaches (Functional Medicine + Trauma-informed + Menopause + ADHD mix). Their photos + stories become the homepage. They get free Pro tier for 12 months in exchange for content + testimonials.

**Risk mitigations:**

- AI session notes hallucination → coach must review/edit before sending follow-up email
- Packages refund logic complexity → start with simple "no refund after 50% of sessions used" default
- SEO landing pages thin content → seed each with 800 words of niche-specific copy + 3 founding coach profiles each

**Definition of done for the 90-day sprint:** Sarah-equivalent persona can sign up, build profile in 5 min, ship 3 packages, take her first booking with intake form, run a session, get an AI summary + draft follow-up, embed her widget on Squarespace — without ever opening Calendly, Stripe Checkout, Typeform, Otter, or ChatGPT.

---

## Part 6 — The Final Verdict

**Co-duck becomes the ALL-IN-ONE coaching platform by:**

- **Doing** five things ruthlessly well in 90 days: niche-native brand + credentials, sub-specialty taxonomy with SEO landing pages, packages + memberships, a Forms primitive that powers intake, and AI session notes that save Sarah 7 hours a week.
- **Killing** seven things that are dragging the product sideways: the "AccrediPro" brand bug, the executive-coach positioning, the 4-step onboarding wizard, the 12-bucket specialty taxonomy, the iConnect/session-prep schema sprawl, the bespoke `session_prep_questions` table (replaced by a generic Forms primitive), and the blanket 10% fee that prices us 18x above Paperbell at scale.
- **Betting** on AI not as a feature but as the layer that makes Co-duck's data substrate uniquely valuable — and earning the right (year 2-3) to ship Sarah's AI Assistant, voice-first mobile, and agentic operations that no incumbent can copy without Co-duck's 32 tables of structured client + session + engagement data.

**The moat is** the combination of (a) marketplace acquisition Paperbell/Practice.do don't have, (b) engagement depth (streaks, check-ins, iConnect-collapsed-into-messages, session prep, programs/goals) Satori/Paperbell don't have, and (c) AI-on-top-of-real-client-data that ChatGPT can't replicate because it has no client memory.

**The risk is** trying to be all-in-one for everyone. The board is unanimous: **win the H&W niche first** — Functional Medicine, Trauma-informed, Menopause, Grief, ADHD, Hormones — and let Career/Executive coaches come back when we've earned the right. Generic = dead. Niche = compounding.

**Score after the 90-day sprint, if all 12 ship: 7.8 / 10** (up from 5.4). To hit 9/10 we need the 12-month horizon (mobile app, AI matching, voice messages, sliding scale, lab results, group circles). To hit 10/10 we need the moonshots — and we should plan for them, but ship the 90-day plan first.

---

> _"The best products subtract before they add. Sarah doesn't need 28 features. She needs 5 great ones, no broken brand, and an AI that does her admin while she sleeps. Ship that in 90 days and we win the niche. Win the niche and the platform follows."_
> — Board, unanimous, 2026-04-16
