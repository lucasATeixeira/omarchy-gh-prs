# 02 - Hide Stale PRs to review

Status: ready-for-agent

Blocked by: 01

Spec: `../spec.md`, sections "Rule", "Modules and interfaces", and "Settings".

## What

The user sets a max age for the To review Tab on the Settings page. PRs to review whose last update is older than that are Stale, and the To review Tab hides them.

## Acceptance criteria

- [ ] `toReviewMaxAgeDays` is in `WidgetSettings`, the manifest `defaults` and `schema`, and the README settings table, with default 365.
- [ ] The panel filters the PRs to review with the functions and poll time from ticket 01.
- [ ] The To review Tab and its count use the filtered list.
- [ ] The "Hide stale PRs" section has a second box, "To review: max days since last update". A change saves and applies right away.
- [ ] The living spec mentions the second max age.
- [ ] The tests and `qmllint` pass.

## Notes

- No new seam: the functions are tested in ticket 01.
- Hand check after `omarchy restart shell`: set the max age below the age of one PR to review and see it leave the To review Tab.
