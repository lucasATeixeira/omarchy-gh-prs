# 01 - Hide Stale Authored PRs

Status: ready-for-agent

Blocked by: None (can start immediately)

Spec: `../spec.md`, sections "Rule", "Modules and interfaces", and "Settings".

## What

The user sets a max age for the Authored Tab on the Settings page. Authored PRs whose last update is older than that are Stale, and the popup and the Badge hide them. Notifications still cover every Authored PR.

## Acceptance criteria

- [ ] A function returns the PRs that are not stale, from a PR list, a max age in days, and the current time. A PR exactly at the limit is kept.
- [ ] A function reads a max-age setting as whole days from 1 to 365, rounding, clamping, and falling back to 365, with exported min, max, and default constants.
- [ ] Tests at both seams, as listed in the spec's Testing Decisions.
- [ ] `authoredMaxAgeDays` is in `WidgetSettings`, the manifest `defaults` and `schema`, and the README settings table, with default 365.
- [ ] The panel keeps the time of the last successful poll and filters the Authored PRs with it.
- [ ] The Authored Tab, its count, the bar Badge, and the header badge use the filtered list.
- [ ] Notifications, the details query, and the previous poll's PR list use the unfiltered Authored PRs.
- [ ] Settings has a "Hide stale PRs" section right after "Refresh", with the box "Authored: max days since last update". A change saves and applies right away.
- [ ] The living spec describes the filter in Popup, Bar, and Settings.
- [ ] The tests and `qmllint` pass.

## Notes

- Hand check after `omarchy restart shell`: set the max age below the age of one Authored PR and see it leave the list and the Badge.
