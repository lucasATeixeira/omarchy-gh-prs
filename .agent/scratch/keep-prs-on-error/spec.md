# Spec: Keep PRs on error and show the Last refresh

Status: resolved

## Problem Statement

When a poll fails, for example because the GitHub API rate limit is exceeded, the popup shows only the error message. The PRs from the previous successful poll disappear, and the Tab counts are hidden. The user loses the whole list until a poll succeeds again, even though the old data is still useful.

The popup also does not say how fresh the list is, so the user cannot tell if the PRs they see are from seconds ago or from an hour ago.

## Solution

A failed poll changes only the error. The popup keeps the PRs from the **Last refresh**: the time of the last successful poll. The error shows in red above the list, as today, and the Sections show below it.

Under the "Pull Requests" title, a small muted label says how long ago the Last refresh was, for example "Refreshed 3 min ago". It shows after the first successful poll, on both Tabs, with or without an error.

## User Stories

1. As a user, I want to keep seeing my PRs when a poll fails, so that a rate limit does not hide my work.
2. As a user, I want to see the error above the old list, so that I know the list may be out of date and why.
3. As a user, I want the Badge to keep showing a red `✕` on error, so that the bar tells me the data is not fresh.
4. As a user, I want the Tab counts to keep showing on error when old PRs are visible, so that the counts match the list.
5. As a user, I want only the error, and no label, when the very first poll fails, so that the popup does not pretend to have data.
6. As a user, I want to see "Refreshed 3 min ago" under the title, so that I know how fresh the list is.
7. As a user, I want the label to keep counting up while polls fail, so that I see how old the data gets.
8. As a user, I want the label to show on every poll, not only on error, so that I can see polling works.
9. As a user, I want the label to change while the popup stays open, so that it does not freeze at "just now".
10. As a user, I want the error to clear and the label to reset when a poll succeeds again, so that the popup goes back to normal by itself.

## Implementation Decisions

- **Domain terms**: the glossary has the new term **Last refresh**. The existing `lastPollTime` already stores it.
- **Failed poll**: `fetchProc.onExited` sets `prs`, `prsToReview`, `viewerLogin`, and `lastPollTime` only on success. On failure it sets only `error`. `parseRun` does not change. Stale PRs keep being measured from `lastPollTime`, so a failed poll does not hide more PRs.
- **"Has data"**: a successful poll happened when `lastPollTime > 0`. This replaces the `loaded && error === ""` checks for the Tab counts, the list, and the empty text.
- **List on error**: the error text shows above the Sections when both exist. If the Last refresh had zero PRs on that Tab, the empty text shows under the error.
- **Badge**: no change. It shows a red `✕` whenever `error` is not empty.
- **Label text**: a pure function in `js/prs.js` turns the Last refresh and the current time into the label. Steps, rounding down:
  - under 1 min: "Refreshed just now"
  - under 1 h: "Refreshed N min ago"
  - under 1 day: "Refreshed N h ago"
  - otherwise: "Refreshed N d ago"
- **Label ticking**: a `now` property holds the current time for the label. A Timer sets it every 30 s while the popup is open, and once when it opens. A successful poll also sets it, so the label says "just now" at once.
- **Label place and style**: under the "Pull Requests" title in the header, in muted text at caption size. It stays muted on error. It shows when `lastPollTime > 0`. It is hidden while Settings is open, like the Tabs.

## Testing Decisions

- Tests check external behavior through the module's exported functions.
- **Label function**: a new test block in `tests/prs.test.js`. Cases: 0 s, 59 s, 60 s, 59 min 59 s, 60 min, 23 h 59 min, 24 h, a few days.
- **`tabs` function**: if its signature or meaning changes, update its tests to match. Do not weaken any assertion.
- **QML**: the QML has no automated tests. The hand check covers the failed poll, the first failed poll, and the label.

## Out of Scope

- A shorter error line with the full message in a tooltip.
- An absolute time, such as "14:32", in the label.
- Backing off or slowing the poll rate after a rate limit error.
- Renaming `lastPollTime`.
