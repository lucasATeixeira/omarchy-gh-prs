# Spec: GitHub PRs bar widget

An Omarchy shell bar widget that shows the CI status of the user's open GitHub pull requests. The bar shows the worst **Status**; clicking it opens a popup with every PR grouped into **Sections**.

## Plugin

- Id `lucas.gh-prs`, at `~/.config/omarchy/plugins/lucas.gh-prs/`, local only, in the bar's `right` section.
- A bar widget; clicking the bar item opens a popup panel.

## Data

- The `gh` CLI runs one GraphQL query: open PRs the user authored, across all repos, drafts included, at most 50.
- CI comes from the latest commit's `statusCheckRollup`. All **Checks** count, not only required ones.
- The same query also reads each PR's `reviewDecision`, `mergeable`, and review threads' `isResolved`.
- Polls every 10 seconds (`refreshIntervalSec` in the manifest defaults), plus a refresh when the popup opens.
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
- Sections, in order: Failing, Running, Passing, No CI. Empty Sections are hidden. Each Section header shows its dot (~10px, twice the row dot) and PR count. Inside a Section, the most recently updated PR comes first.
- Row: a small Status dot (~5px), `owner/repo#123`, the title elided with "…", and a "draft" label after the title when the PR is a draft. Clicking a row opens the PR in the browser and closes the popup.
- Before the first fetch ends: no list and no empty message.
- Zero PRs: "No open pull requests".
- On error: only the error message. When the cause is auth, the message is "Not logged in to GitHub. Run: gh auth login". The error clears on the next successful poll.

## AI review

Some repos run an AI code reviewer in CI, such as CodeRabbit. The widget tells the user when its review is ready to read, even while other **Checks** still run.

- Setting `aiCheckNames`: a comma-separated string, default `"CodeRabbit"`. A Check is an **AI Check** when its name contains one of the patterns, ignoring case. The name is `context` for a commit status and `name` for a check run.
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
- Drafts are included. No setting.

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
- No notifications for review decision, threads, or conflicts.

## Tests

- Pure logic lives in `js/prs.js` and is tested with `node:test` in `tests/prs.test.js`.
- The QML UI has no automated tests; check it by restarting the shell and looking at the bar and the popup.

## Known limits

- Only the first 100 Checks of a PR are read.
- Only the first 100 review threads of a PR are read, so the Unresolved thread count is at most 100.
- A Status change that starts and ends between two polls is missed, for example a new commit whose CI finishes in less than one poll interval.
- The auth hint relies on `gh` printing "gh auth login" in its error output.
