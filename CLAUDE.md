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

- **Anything that needs Jovial's input goes in a Google Sheet** (Jovial, 31 Oct), not a doc or a chat list: [GSP portal: inputs from Jovial](https://docs.google.com/spreadsheets/d/1FssT6z-AQP6JNQdf64mcRtMt1sdZ3lkhpO_5gWhAHBQ/edit). Add a tab or rows there, prefilled with what the prototype uses today.

## Branches

- `main` always holds the latest working prototype. Each piece of work gets a short branch (`admin-config`, `roles`, `commissions`…), merged into `main` once it's built and tested. Roles live in their own folders under `designs/agency/src/`, not on branches.
