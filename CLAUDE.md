# upGrad GSP

The agency portal prototype lives in `designs/agency/`. `README.md` there describes every screen; `PLAN.md` holds the plan and the recorded design decisions.

## Review changes: remind before every page change

`designs/agency/REVIEW.md` lists, page by page, the changes agreed in review meetings with Deepesh (CPTO), Jovial (PM) and Rishi (engineering).

- **Before changing a page,** read that page's section in `REVIEW.md`, plus "Everywhere". Start your reply by listing its open items (and open questions) in a few lines, so Nesil can fold them into the change or leave them for later. Say so when a page has none.
- **When the work completes an item,** tick it in `REVIEW.md` with the date and the commit, in the same commit as the change.
- **When a request contradicts an agreed decision** (marked "Decision"), point it out before building.
- New review meetings add a dated section to `REVIEW.md`; keep the by-page layout.

## Show the prototype when a task is done

- **Every time a task is done** (Nesil, 29 Oct), build the shared file (`npm run build:artifact` in `designs/agency`) and send `designs/agency/dist-artifact/gsp-partner-portal.html` to Nesil, so the latest version opens in the conversation. Say which role and screen to look at.
