# Spec: GitHub PRs bar widget

An Omarchy shell bar widget that shows the CI status of the user's open GitHub pull requests. The bar shows the worst **Status**; clicking it opens a popup with every PR grouped into **Sections**.

## Plugin

- Id `lucas.gh-prs`, at `~/.config/omarchy/plugins/lucas.gh-prs/`, local only, in the bar's `right` section.
- A bar widget; clicking the bar item opens a popup panel.

## Data

- The `gh` CLI runs one GraphQL query: open PRs the user authored, across all repos, drafts included, at most 50.
- CI comes from the latest commit's `statusCheckRollup`. All **Checks** count, not only required ones.
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
- Sections, in order: Failing, Running, Passing, No CI. Empty Sections are hidden. Each Section header shows its dot (~7px) and PR count. Inside a Section, the most recently updated PR comes first.
- Row: a small Status dot (~5px), `owner/repo#123`, the title elided with "…", and a "draft" label after the title when the PR is a draft. Clicking a row opens the PR in the browser and closes the popup.
- Before the first fetch ends: no list and no empty message.
- Zero PRs: "No open pull requests".
- On error: only the error message. When the cause is auth, the message is "Not logged in to GitHub. Run: gh auth login". The error clears on the next successful poll.

## Tests

- Pure logic lives in `js/prs.js` and is tested with `node:test` in `tests/prs.test.js`.
- The QML UI has no automated tests; check it by restarting the shell and looking at the bar and the popup.

## Known limits

- Only the first 100 Checks of a PR are read.
- The auth hint relies on `gh` printing "gh auth login" in its error output.
