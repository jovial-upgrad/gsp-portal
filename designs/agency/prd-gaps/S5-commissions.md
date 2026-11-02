# Commission engine vs the commissions team's scenarios (Commission_2.xlsx, 2 Nov 2026)

Source: the commissions team's sheet *Commission_2.xlsx*, tab **IP** (19 institution scenarios) and tab **RP** (7 agent
scenarios); the slice 5 PRD "Money" (S5-2 versions, S5-7 gross/net, S5-9 rounding, S5-15 rework at period end, S5-22
University groups); a test of the old engine against the sheet (2 Nov: correct IP1, IP18, RP1–RP4, RP6; wrong IP2, IP4;
partly IP3, IP6, IP12–IP15, IP17, IP19, RP5; missing IP5, IP7–IP11, IP16, RP7). Branch `commissions-26`.

**One engine.** `src/finance/engine.ts` runs the portal (Finance pages, the application's Commission tab, the
"Base commission" row), the standalone **Commissions Sandbox** (`sandbox/sandbox.src.html`, built with
`npm run build:sandbox`, which bundles this same file into the page) and the test (`npm run test:commissions`). The
cases and their hand-worked expected values are in `src/finance/scenarioCases.ts`: **33 cases, 159 checks, all pass**
(the old engine passes 7 of 33). Every line carries its working (`trace`): the terms version, every rate row
considered and why it was or wasn't used, the tier pool with each student in order, every promotion and notice in or
out and why, the fee base, the period, the amount, top-ups, FX and the sheet scenario it answers.

Each line: scenario → what changed → the rule now. **Proposal** = a choice the sheet and the PRD don't settle (also
listed at the end for Jovial's sheet).

## Institutions (IP): what a university pays GSP

- [x] **IP1 Basic rate, % or amount.** Unchanged (was correct). Level table: % or a fixed amount per level. A fixed amount is paid once per student with the first period unless a rate row ties it to a study period.
- [x] **IP2 Tier, retrospective, academic year.** Was: calendar year only; a top-up on a paid line showed *Paid* and couldn't be invoiced, while the RP's top-up was paid anyway. Now: tiers count per calendar, **academic year with its own start month** (UK Sep–Aug, AU Jan–Dec), financial year or intake. When the band rises on a line already billed, the line keeps what was billed and a **Tier top-up** line (GSP's receivable, *Top-up to invoice*) carries the difference, with its own invoice and payment. The RP's top-up is paid only on what GSP has received (*Paid; top-up waits for the university*). If the band later falls at the rework, the top-up is a negative *Credit to university*.
- [x] **IP3 Tier, prospective, academic year.** Was: calendar year only. Now any window, as IP2; each student keeps the band of their own place.
- [x] **IP4 Tier, intake-wise.** Was: pooled by the census month. Now: pooled by the application's **intake** (study start), never the census or payment month.
- [x] **IP5 Rate by study period.** New. Rate rows can name a study period (`period=2`, `3+`, `1-2`). Period numbers run through the course (semester 3 is the first of year 2).
- [x] **IP6 Rate by sector or course.** Was: level only. Now: rate rows by course (any level, or level + course). The application holds the **course**.
- [x] **IP7 Rate by region.** New. Rate rows by the student's source country or a **region group** (SEA, South Asia: Settings › Region groups).
- [x] **IP8 Course and region.** New. Rows can combine any of level, course, campus, region and period. **The most specific matching row wins**; the level table is the fallback.
- [x] **IP9–IP11 University promotions by region, intake or academic year, course or sector.** New. Each university has promotions with intakes from/to, named intakes (2026-07), regions, courses, levels, campuses; **matched on the intake start**. A promotion either wins when higher (*highest*), replaces the rate, or adds an **additional commission** line.
- [x] **IP12 Institution and group tier.** Was: free-text group; a college couldn't have its own tier and a group tier; a member without a tier wasn't counted. Now: **University groups** are Finance's list (S5-22: name, members, an optional group tier; a university in at most one group). Every member counts toward the group tier. A college can have its own tier too.
- [x] **IP13 Gross / net.** Was: scholarship always deducted. Now (S5-7): the final tuition fee on the application is the net fee (after scholarship, as on the CoE); a university set to **Commission on gross fee** adds back the scholarship on the application.
- [x] **IP14 Chargeable time.** Was: years × instalments only, later years repeating year 1. Now: chargeable for the whole course, N years, semesters, trimesters, terms, N units, or the fees paid up to a limit. A period half inside the limit counts its share. Each year uses its own fee when the application holds it (**Fees by year**).
- [x] **IP15 Paid yearly, by semester, term, unit or fees paid.** Was: 4 terms all on one date; 31 Mar + 8 months slipped to 1 Dec; no unit or fees-paid. Now: paid once a year, each semester, trimester, term, per unit (each unit's own census) or on each fee payment (dated the payment). Each period has its own date: the application's census date for it when held, otherwise offsets kept inside the month (31 Mar → 31 Jul → 30 Nov).
- [x] **IP16 Campus.** New. The application holds the campus; rate rows can name it.
- [x] **IP17 Agreement dates.** Was: end date only, no versions. Now: **agreement start and end**; an intake outside them is held (*Held: agreement not yet in force* / *contract ended*) and goes to exceptions. Terms are **versioned with an effective-from date** (S5-2); each enrolment is priced by the version in force on its intake.
- [x] **IP18 Currencies.** Unchanged (was correct). The AUD view uses the week's rate for the **trigger date** (today's when the trigger is still ahead). The FX table's columns now cover every currency a university or RP uses (EUR, CAD…).
- [x] **IP19 Standard, bonus, additional.** Was: a fixed bonus per band, not enterable. Now: three line types. **Standard commission**; **Bonus**, fixed or % of the first-year fee, per tier band, per student (a bonus scheme) or once N students enrol (lump sum on the Nth student); **Additional commission** (a promotion set to *additional*). All enterable in Setup.

## Agents (RP): what GSP pays the RP

- [x] **RP1 Basic rates.** Unchanged.
- [x] **RP2 Tier retrospective + 50% special lead.** Unchanged maths; the special lead now records **both** conditions on the application: *GSP lead* (GSP gave a qualified lead) and *Enrolment-ready* (the RP's application was enrolment-ready). Only both give 50%.
- [x] **RP3 Tier prospective.** Unchanged maths.
- [x] **RP4 Promotion by region.** Was: one region text matched by prefix, so "SEA" matched nothing. Now: notices list **sales regions**, and region groups (SEA) work.
- [x] **RP5 Promotion by intake or FY.** Was: matched on the enrolment date. Now: notices match the **intake** (from/to dates, or named intakes like 2026-07).
- [x] **RP6 Promotion by institution or destination.** Unchanged (was correct).
- [x] **RP7 Promotion as % of tuition.** New notice structure *% of the student's tuition fee*: an extra RP line (final tuition fee × %) paid once GSP has received the university's commission; as a box it replaces the RP's share.

## Combinations

- [x] **C1 Tier + promotion on one student; the RP cap.** University: tier vs promotion, highest wins. RP: a notice that adds on is **capped at 100% of GSP's line** (Settings › RP cap).
- [x] **C2 Course + region (+ campus).** The most specific row wins; the working lists every row considered and why each was rejected.
- [x] **C3 College tier vs group tier.** Both computed; **the higher rate wins**, they don't stack.
- [x] **C4 RP retrospective recount at the 5th.** Earlier students' top-ups (+225 each) become payable; RP tier windows now count by **intake**, not the date GSP was paid.
- [x] **C5 50% lead overriding the tier.** A special lead doesn't count toward the tier; a GSP lead that isn't enrolment-ready gets standard terms, counts, and is flagged.
- [x] **C6 Withdrawal and end-of-period rework (S5-15).** A refunded withdrawal doesn't drop the band at once: the student counts until the window ends, the RP page shows *Rework pending*, and after the window the band is re-worked (others' lines become *To recover*). Same rule on university tiers.
- [x] **C7 GBP → AUD → INR.** Payout conversion through AUD with the week's rates; the payout run shows each line's chain (2,400 × 1.95 = AUD 4,680.00 ÷ 0.0175 = INR 2,67,428.57).

## Where it shows

- **Commissions Sandbox** (primary): new tab **Commission scenarios**: one card per case with the sheet's wording, the terms set up, the sample students, the hand calculation, expected vs engine, Pass/Fail, **Open the case** (the case's own world in memory, separate from the sandbox's data, with the normal Simulate, Ledgers, Payout run, Exceptions and Setup tabs) and **Download CSV / Copy CSV**. Every line has **How it's worked out**. **Setup** takes every new dimension (agreement start, basis, paid/chargeable, rate rows, tier window and pool, band bonuses, promotions, bonus schemes, versions; *University groups*; notice regions, intakes, levels, % of tuition; Settings: region groups, RP cap), with validation and error copy. No system controls: the page's own select menus, calendar, ticks and number fields.
- **Portal, GSP · Finance**: Commissions › **Commission scenarios** (same cases, Pass/Fail, CSV through the portal's download, each case's lines with their working). University and RP lines' *How it's worked out* now show the engine's steps. The application's **Base commission** row is the engine's estimate of the RP's first-year share (was tuition × rate × 70%). The RP's own Commission tab keeps the RP-facing working (no university rate, no other students' names).
- Not yet in the portal: Finance › Commission terms (Terms.tsx) can't edit the new dimensions (the sandbox's Setup can); Admin and View Only don't get Finance's menu in this prototype; course cards in search still estimate Base commission from the course (no application yet).

## Proposals (choices the sheet and PRD don't settle)

1. Two equally specific rate rows match: the first listed wins, flagged in exceptions.
2. A tier replaces the level rate; against a more specific row (course, campus, region, period) the higher of the two wins.
3. College tier and group tier on one student: the higher rate wins; they don't stack.
4. University promotions combine as highest (default), replace, or additional; a fixed-amount promotion can only be additional.
5. Additional commission is shared with the RP at its rate; bonuses (band, per student, threshold) are GSP's only.
6. Band and per-student bonuses as a % are on the first-year fee base; a threshold bonus is a fixed lump sum on the Nth student.
7. A fixed amount without a study period is paid once per student, with the first period.
8. Chargeable "fees paid" means the fees the student pays up to a limit (blank = all); a period partly inside a time limit counts its share.
9. No fee on the application for a later year: the first year's fee is used, and the working says so (Finance to confirm).
10. Gross basis adds the scholarship back to year 1 only (the scholarship on the application is the first year's).
11. Unit and fee-payment schedules take the units' and payments' amounts as given (no gross add-back).
12. University AUD view at the trigger date's week (today's while the trigger is ahead).
13. RP "adds on" notices are capped at 100% of GSP's line (Settings › RP cap).
14. Two notices of the same kind cover one enrolment: a notice listing the RP beats a region-wide one, then the higher rate wins.
15. The 50% special lead needs both GSP lead and Enrolment-ready; a GSP lead without enrolment-ready gets the standard terms, counts toward the tier, and is flagged.
16. A % of tuition promotion is paid once GSP has received the university's commission; it adds on (or replaces the share as a box); flagged when it is more than GSP earns on the student.
17. Tier rework (S5-15) for intake windows: the period ends on the intake's last trigger date (university tiers) or 6 months after the intake (RP); calendar, academic and financial windows end on their last day.
18. Order inside a tier window: by intake, then enrolment date, then application.
19. Versions in the sandbox change the level rates (the full terms set is versioned in the build).
