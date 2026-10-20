# Spec: GitHub PRs bar widget

An Omarchy shell bar widget that shows the CI status of the user's open GitHub pull requests. The bar shows the worst **Status**; clicking it opens a popup with every PR grouped into **Sections**.

## Plugin

- Id `lucas.gh-prs`, at `~/.config/omarchy/plugins/lucas.gh-prs/`, local only, in the bar's `right` section.
- A bar widget; clicking the bar item opens a popup panel.

## Data

- The `gh` CLI runs one GraphQL query: open PRs the user authored, across all repos, drafts included, at most 50.
- CI comes from the latest commit's `statusCheckRollup`. All **Checks** count, not only required ones.
- The same query also reads each PR's `reviewDecision`, `mergeable`, and review threads' `isResolved`.
- The same query also reads each PR's node `id` and the viewer's login. It costs 2 points, measured with `rateLimit(dryRun: true)`.
- **Details query**: for PRs of the last successful poll that are missing from the current one or whose `updatedAt` changed, a second query, `nodes(ids: ...)`, reads their `state`, `mergedBy`, the actor of their latest `ClosedEvent`, and the latest 20 comments of each of the first 100 review threads, with author login and `publishedAt`. It costs about 1 point per PR, measured. It does not run on the first poll or when no PR needs it.
- A new poll does not start while the main query or the details query runs.
- Polls every `refreshIntervalSec` seconds (default 10), plus a refresh when the popup opens.
- Setup: the user runs `gh auth login` once.

## Status rules

Each **Check** is classified, then a PR takes the worst Status among its Checks.

| Status | Color | Rule |
| --- | --- | --- |
| failing | red | At least one Check is `FAILURE`, `ERROR`, `CANCELLED`, `TIMED_OUT`, `ACTION_REQUIRED`, `STARTUP_FAILURE`, or any other unknown result. |
| running | yellow | Nothing failing, and at least one Check is unfinished (`QUEUED`, `IN_PROGRESS`, `PENDING`, `WAITING`, `REQUESTED`, `EXPECTED`). |
| passing | green | Every Check is `SUCCESS`, `NEUTRAL`, or `SKIPPED`. |
| none | gray | The PR has no Checks. |

- Colors come from the current theme's `colors.toml` (`red`, `yellow`, `green`, falling back to `color1`, `color3`, `color2`, then fixed hex values).
- `STALE` and unknown results count as failing, so green always means "every Check passed".

## Bar

- The GitHub Nerd Font icon is always shown.
- The **Badge** shows the **Bar summary**: the worst Status and how many PRs have it.
- The Badge is a filled disc at the icon's top-right corner, in the Status color, with the count in bold text and a thin rim in the bar background color. It widens to a pill for 2-digit counts.
- On error: a red Badge with `✕`.
- No Badge when every PR is `none`, or there are no PRs.
- The bar item uses a normal icon slot.

## Popup

- Max height: 60% of the screen height; below that it fits its content.
- Header: "Pull Requests" plus the Bar summary as `● 1`. It stays fixed; only the Sections scroll.
- A thin scrollbar on the right appears only when the list overflows.
- Sections, in order: Failing, Running, Passing, No CI. Empty Sections are hidden. Each Section header shows its dot (~8px, larger than the row dot) and PR count. Inside a Section, the most recently updated PR comes first.
- Row: a small Status dot (~5px), `owner/repo#123`, the title elided with "…", and a "draft" label after the title when the PR is a draft. Clicking a row opens the PR in the browser and closes the popup.
- Before the first fetch ends: no list and no empty message.
- Zero PRs: "No open pull requests".
- Escape closes the popup, and Tab switches to the next bar panel, like the shell's own panels.
- On error: only the error message. When the cause is auth, the message is "Not logged in to GitHub. Run: gh auth login". The error clears on the next successful poll.

## AI review

Some repos run an AI code reviewer in CI, such as CodeRabbit. The widget tells the user when its review is ready to read, even while other **Checks** still run.

- Setting `aiCheckNames`: a comma-separated string of **AI check patterns**, default `"CodeRabbit"`. A Check is an **AI Check** when its name contains one of the patterns, ignoring case. The name is `context` for a commit status and `name` for a check run.
- **AI review done**: the latest commit has at least one AI Check, and every AI Check on it has finished, with any result. A new commit makes the PR not done again.
- Status rules, Sections, and the Badge do not change. An AI Check counts toward the PR's Status like any other Check.
- Row: a robot icon to the right of the Status dot when the AI review is done. Always in the normal text color. PRs without AI Checks look as before.
- Notification: when a PR was seen in the last successful poll as not done and is done now. Title `AI review done`, body `owner/repo#123 — <PR title>`. Clicking it opens the PR.
- No notification on the first poll after a start, or for a PR seen for the first time.
- A failed poll does not change the last seen PRs.
- Bot PR reviews without a Check, such as Copilot's, are out of scope.

## CI notification

The widget tells the user when a PR's **CI finished**, so they do not need to watch the bar while CI runs.

- **CI finished**: the PR's Status was `running` in the last successful poll and is `failing` or `passing` now.
- A failing Check makes the PR `failing` while other Checks still run, so a failure notifies as soon as it happens.
- Other changes do not notify: `passing` → `failing`, `failing` → `passing`, and `running` → `none`.
- Title `CI passed` or `CI failed`, body `owner/repo#123 — <PR title>`. Clicking it opens the PR.
- One notification per PR. When the AI review is done and CI finished in the same poll, both notifications are sent.
- Same rules as the AI review notification: none on the first poll after a start, none for a PR seen for the first time, and a failed poll does not change the last seen PRs.
- Drafts are included. Each notification can be turned off in Settings.

## Review notification

The widget tells the user when a reviewer approves a PR or requests changes. This works in every repo, also in repos that do not require reviews, because it reads `latestReviews` and not `reviewDecision`.

- The main query reads each reviewer's latest Review: id, state, and author login. Its cost stays at 2 points.
- A new Review is one whose id was not in the same PR's latest Reviews in the last successful poll.
- Title `Approved by <login>` for `APPROVED`, `Changes requested by <login>` for `CHANGES_REQUESTED`. Body `owner/repo#123 — <PR title>`. Clicking it opens the PR.
- `COMMENTED` and `DISMISSED` Reviews send nothing.
- One notification per Review: two reviewers in the same poll give two notifications, and a second approval from the same reviewer after a new commit notifies again.
- Same rules as the AI review notification: none on the first poll after a start, none for a PR seen for the first time, and drafts are included.

## Merged and closed notification

- When a PR of the last successful poll is missing from the current one, the details query reads its state.
- `MERGED`: title `PR merged by <login>`. `CLOSED`: title `PR closed by <login>`. The body uses the PR data from the last poll. Clicking it opens the PR.
- Nothing is sent when the viewer merged or closed the PR, or when the state is still `OPEN`, for example a PR that fell out of the 50 most recently updated.
- If the details query fails, that poll's merged and closed notifications are skipped. The other notifications are still sent, and the PR list still updates.

## Code comment notification

- When a PR of the last successful poll has a new `updatedAt`, the details query reads its Code comments. A new Code comment changes `updatedAt`, checked on real PRs.
- A Code comment counts when its `publishedAt` is later than the PR's `updatedAt` in the last poll and its author is not the viewer. New threads and replies count, in resolved threads too. Bot authors count.
- One notification per PR per poll. Title `New code comment from <login>` for one comment, `<n> new code comments` for more. Body `owner/repo#123 — <PR title>`. Clicking it opens the PR.
- A Review notification and a Code comment notification for the same PR in the same poll are both sent.
- Same rules as the AI review notification: none on the first poll after a start, none for a PR seen for the first time, and drafts are included.
- If the details query fails, that poll's Code comment notifications are skipped.

## Review and merge icons

Icons on each row show if a PR is ready to merge. They do not change Status, Sections, or the Badge.

- Row order: Status dot, robot, **Review decision** icon, **Unresolved thread** icon with count, **Conflict** icon, then `owner/repo#123`, the title, and "draft".
- Each icon is hidden when it does not apply, so it takes no space.
- All row icons, the robot included, use the `caption` font size and the normal text color.
- Review decision, from the PR's `reviewDecision`:
  - `APPROVED`: `nf-md-check_circle`.
  - `CHANGES_REQUESTED`: `nf-md-file_document_edit`.
  - `REVIEW_REQUIRED` or `null`: no icon.
- Unresolved threads: `nf-md-comment_outline` followed by the number of review threads with `isResolved` false. Every thread counts: from any author, bots included, outdated included. Plain conversation comments are not counted, because they cannot be resolved. No icon when the count is 0.
- Conflict: `nf-md-alert` when `mergeable` is `CONFLICTING`. `MERGEABLE` and `UNKNOWN` show no icon.
- The review decision icon does not notify; Review notifications come from `latestReviews`, see "Review notification". Code comments notify, see "Code comment notification". No notifications for conflicts.

## Settings

A gear button in the popup lets the user change the widget's settings without editing `shell.json` by hand.

### Settings page

- A gear button (`nf-md-cog`) sits on the right of the popup header, next to the Bar summary. Clicking it replaces the PR list with the settings page.
- While the page is open, the header title is "Settings" and the gear becomes a back arrow (`nf-md-arrow_left`). The back arrow or Escape returns to the PR list.
- Three plain sections, in order: Refresh, AI checks, Notifications. No collapsing.
- Every change applies right away and is saved to the widget's entry in `shell.json` through `bar.shell.updateEntryInline`. Toggles save on click; fields save on Enter or when they lose focus. All other keys in the entry are kept.

### Refresh

- `refreshIntervalSec`: a whole number of seconds, from 5 to 3600, default 10.
- A number field with up and down arrows that step by 5. A typed value outside the range is clamped to the nearest limit; a value that is not a number goes back to the saved value.
- The poll timer uses the new interval right away.

### AI checks

- Shows the **AI check patterns** from `aiCheckNames` as a list, one row per pattern, each with an ✕ that removes it.
- A text field and an Add button below the list. Enter in the field also adds.
- Add splits the text on commas, trims each part, and skips blank parts and patterns already in the list, ignoring case.
- The setting stays a comma-separated string; the list is joined with `, ` when saved.
- An empty list is allowed. The page then shows "No AI check patterns. The robot icon and AI review notifications are off."
- When the patterns change, the widget polls right away and forgets the last seen PRs, so that poll sends no notifications. Without this, every PR whose new AI Checks already finished would notify at once.

### Notifications

| Key | Default | Meaning |
| --- | --- | --- |
| `notificationsEnabled` | `true` | Master switch. When off, no notification is sent. |
| `notifyAiReviewDone` | `true` | Send `AI review done`. |
| `notifyCiPassed` | `true` | Send `CI passed`. |
| `notifyCiFailed` | `true` | Send `CI failed`. |
| `notifyApproved` | `true` | Send `Approved by <login>`. |
| `notifyChangesRequested` | `true` | Send `Changes requested by <login>`. |
| `notifyCodeComments` | `true` | Send `New code comment from <login>` or `<n> new code comments`. |
| `notifyMerged` | `true` | Send `PR merged by <login>`. |
| `notifyClosed` | `true` | Send `PR closed by <login>`. |

- The toggles sit under the master switch, indented. When the master switch is off, they are greyed out and cannot be changed, but keep their values.
- Turning a notification off does not change how the last seen PRs are tracked, so turning it back on does not send old notifications.

### Manifest

- `defaults` and `schema` list every key above, so they can still be edited by hand. `refreshIntervalSec` is an `integer` with `min: 5` and `max: 3600`; the notification keys are `boolean`.

## Tests

- Pure logic lives in `js/prs.js` and is tested with `node:test` in `tests/prs.test.js`.
- The QML UI has no automated tests; check it by restarting the shell and looking at the bar and the popup.

## Known limits

- Only the first 100 Checks of a PR are read.
- Only the first 100 review threads of a PR are read, so the Unresolved thread count is at most 100.
- A Status change that starts and ends between two polls is missed, for example a new commit whose CI finishes in less than one poll interval.
- The auth hint relies on `gh` printing "gh auth login" in its error output.
- If the details query fails, that poll's Code comment, merged, and closed notifications are lost.
- Only the first 100 review threads of a PR and the latest 20 comments of each thread are read for Code comment notifications.
- A Code comment that does not change the PR's `updatedAt` is missed.
- A PR merged or closed during the poll right after the AI check patterns change sends nothing, because that poll forgets the last seen PRs.
