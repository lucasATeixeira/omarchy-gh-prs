# Spec: Hide Stale PRs

Status: ready-for-agent

## Problem Statement

Both Tabs show every open PR, even PRs nobody touched in months. Abandoned **Authored PRs** and old **PRs to review** fill the list and push the PRs I work on down. An old failing PR can also keep the bar **Badge** red, even though I do not care about it anymore.

## Solution

Each Tab gets a max age in days, set on the Settings page. A **Stale PR** is a PR whose last update is older than its Tab's max age. The popup and the Badge hide Stale PRs. Notifications still cover every Authored PR, so an old PR that suddenly gets a Review still tells me.

Both max ages default to 365 days, so nothing I see today disappears after the update unless I lower the number.

## User Stories

1. As a PR author, I want to hide Authored PRs with no update in X days, so that abandoned PRs do not fill my list.
2. As a reviewer, I want to hide PRs to review with no update in X days, so that old requests do not hide the fresh ones.
3. As a user, I want a separate max age for each Tab, so that I can be strict with old review requests and lenient with my own PRs.
4. As a user, I want a PR with a new comment or commit to come back, so that an old PR with new activity is never hidden.
5. As a user, I want a PR to be stale only after X × 24 hours without updates, so that the rule does not depend on time zones.
6. As a user, I want the Tab counts to count only PRs that are not stale, so that each count matches its list.
7. As a PR author, I want the Badge to ignore Stale PRs, so that an abandoned failing PR does not keep the bar red.
8. As a PR author, I want the header badge to ignore Stale PRs too, so that it matches the bar.
9. As a PR author, I want notifications for Stale PRs to keep working, so that I hear about a Review on an old PR.
10. As a user, I want "No open pull requests" or "No PRs to review" when every PR in a Tab is stale, so that the empty state stays clear.
11. As a user, I want no "hidden" hint in the list, so that the popup stays clean; the setting is one click away.
12. As a user, I want both max ages to default to 365 days, so that an update does not hide PRs I see today.
13. As a user, I want to set each max age from 1 to 365 days in steps of 1, so that I can choose any limit up to a year.
14. As a user, I want a typed value outside the range to be clamped, so that a mistake cannot hide everything or break the list.
15. As a user who edits `shell.json` by hand, I want a value that is not a number to fall back to 365, so that a typo does not break the widget.
16. As a user, I want the max ages in a "Hide stale PRs" section right after "Refresh", so that I find the settings that change the list together.
17. As a user, I want a change to a max age to apply right away, so that I see the effect without waiting for the next poll.
18. As a user, I want to set both max ages in `shell.json` too, so that I can keep my config in my dotfiles.

## Implementation Decisions

### Rule

- A PR is a Stale PR when its `updatedAt` is more than its Tab's max age × 24 hours before the time of the last successful poll. A PR exactly at the limit is not stale.
- The widget filters after the fetch. The GitHub searches do not change, and each search still returns at most 50 PRs before the filter.
- The notification logic, the details query, and the previous poll's PR list keep using the unfiltered Authored PRs.

### Modules and interfaces

- **The PR logic module**:
  - A function that returns the PRs that are not stale, from a PR list, a max age in days, and the current time.
  - A function that reads one max-age setting as whole days from 1 to 365: it rounds, clamps, and falls back to 365 for a value that is not a number. It follows the existing refresh interval function, with min, max, and default constants exported for the settings view.
  - `WidgetSettings` gets the two new keys.
  - The Tabs function and the Bar summary function do not change. They get the filtered lists.
- **The panel QML**:
  - Reads both settings through the new parse function.
  - Keeps the time of the last successful poll.
  - Filters the Authored PRs and the PRs to review once each. The filtered lists feed the Tabs and the Bar summary.
- **The settings view QML**: a "Hide stale PRs" section right after "Refresh", with two `NumberField` boxes, "Authored: max days since last update" and "To review: max days since last update". Each saves its key right away.

### Settings

| Key | Default | Label |
| --- | --- | --- |
| `authoredMaxAgeDays` | `365` | Authored: max days since last update |
| `toReviewMaxAgeDays` | `365` | To review: max days since last update |

- Both go into the manifest's `defaults`, and into its `schema` as `integer` with min 1, max 365, step 1.
- Both go into the README settings table.

### Docs

- The glossary defines Stale PR, and Bar summary skips Stale PRs.
- The living spec (`../gh-prs/spec.md`) gets the filter in Popup, Bar, and Settings.

## Testing Decisions

- A good test calls a public function with plain data and checks what comes out. It does not check how the function works inside.
- **Seam 1, the filter function**: a PR inside the limit is kept, a PR older than the limit is hidden, a PR exactly at X × 24 hours is kept and one millisecond older is hidden, and an empty list stays empty.
- **Seam 2, the setting parse function**: a value in range is kept, values outside the range are clamped to 1 and 365, a decimal is rounded, a numeric string is read, and a value that is not a number gives 365.
- Prior art: the `refreshIntervalSec` tests and the `tabs` tests. They use `node:test` and load the QML library with the existing loader. Existing tests stay unchanged.
- The QML has no automated tests. Check the Settings section, the filtered lists, counts, and Badge by hand after `omarchy restart shell`.

## Out of Scope

- A way to turn the filter off. 365 days is the most lenient value.
- A "hidden" note or count in the popup.
- Filtering by creation date.
- Changing the GitHub search to filter on the server.
- Hiding Stale PRs from notifications.

## Further Notes

- A PR that becomes stale between polls stays visible until the next poll, because the time of the last poll is the reference.
