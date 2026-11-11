# upGrad GSP

Our own copy (Jovial, 31 Oct), started from NesilNoble/upgrad-gsp at `claude/amazing-bell-c5nboe` (5e73bd2). Built independently of Nesil's repository.

The agency portal prototype lives in `designs/agency/`. `README.md` there describes every screen; `PLAN.md` holds the plan and the recorded design decisions.

## Review changes: remind before every page change

`designs/agency/REVIEW.md` lists, page by page, the changes agreed in review meetings with Deepesh (CPTO), Jovial (PM) and Rishi (engineering).

- **Before changing a page,** read that page's section in `REVIEW.md`, plus "Everywhere". Start your reply by listing its open items (and open questions) in a few lines, so Jovial can fold them into the change or leave them for later. Say so when a page has none.
- **When the work completes an item,** tick it in `REVIEW.md` with the date and the commit, in the same commit as the change.
- **When a request contradicts an agreed decision** (marked "Decision"), point it out before building.
- New review meetings add a dated section to `REVIEW.md`; keep the by-page layout.

## Show the prototype when a task is done

- **Every time a task is done**, build the shared file (`npm run build:artifact` in `designs/agency`) and send `designs/agency/dist-artifact/gsp-partner-portal.html` to Jovial, so the latest version opens in the conversation. Say which role and screen to look at.

## Asking Jovial for input

- **Ask Jovial in the chat** (Jovial, 11 Nov): the Pending Questions sheet became too much, so it is no longer used. Put every question in the conversation, numbered, each with what the prototype does today and a proposed answer, so he can reply "ok" or change it. (The sheet stays as the record of Q1–Q116.)

## Nothing hard-coded (Jovial, 2 Nov): a hard rule, no exceptions

- **Never hard-code anything into the prototype.** Every task, notification, email, log line, status, count, list of options, label that names data, rate, rule and date must come from the data stores and settings (Admin, Finance, work rules) through the same code path the real product would use.
- Sample data is allowed only as seeded **records** (RPs, students, universities, courses, applications, settings) loaded into the stores. Everything derived from them (tasks, SLAs, notifications, emails, commission lines, dashboards, Activity) is computed by the rules at run time, never written into the seed or a component.
- No fixed lists in components: dropdown options, filters, tags, levels, countries, statuses and reasons come from their settings or data module. No placeholder or example rows in UI code.
- Anything a page needs that has no data source yet gets one (a setting or a store) before the page uses it. If that isn't possible, stop and ask Jovial (in the chat); don't fake it.
- Every branch's checks include a scan for hard-coded data, and a test that fails if a derived item exists that no rule produced.

## Branches

- `main` always holds the latest working prototype. Each piece of work gets a short branch (`admin-config`, `roles`, `commissions`…), merged into `main` once it's built and tested. Roles live in their own folders under `designs/agency/src/`, not on branches.

## No Figma from now on (Jovial, 2 Nov)

- **The deliverables are the PRD docs and the prototype artifact only.** Don't create or update Figma files or wireframes; the prototype (one Claude artifact link) is the design. Existing Figma pages are no longer maintained.

## Regression across slices (Jovial, 2 Nov)

- **Any decision that changes something already written or drawn** (an earlier slice's PRD or the prototype) gets a row in `designs/agency/REGRESSION.md` (from 11 Nov; earlier rows stay in the sheet's *Regression* tab): the decision, its source, the slices affected, and whether the docs and prototype are updated.
- Before engineering picks up a slice, run a regression pass: apply every open Regression row to the docs and the prototype, then mark the row done.
