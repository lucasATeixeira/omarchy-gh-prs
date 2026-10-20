# GitHub PRs

An Omarchy bar widget that shows the CI status of your open GitHub pull requests.

The bar shows the GitHub icon with a badge: the worst CI status among your PRs and how many PRs have it. Red means a check failed, yellow means checks are still running, and green means every check passed. Click it to see your PRs grouped into Failing, Running, Passing, and No CI. Click a PR to open it in the browser.

The popup has two tabs. **Authored** lists the PRs you opened. **To review** lists the open PRs that wait for your review, asked from you or from one of your teams, and shows who opened each one. Press `h`/`l` or Left/Right to switch tabs. The badge and the notifications only count your authored PRs.

When a PR's checks stop running and pass or fail, you get a notification. You also get one when a reviewer approves a PR or requests changes, when someone else writes new code comments, and when someone else merges or closes your PR. Click it to open the PR. Each notification can be turned off in Settings.

A check icon with a number shows how many reviewers approved a PR, and a document icon shows when changes are requested. A comment icon with a number shows how many review threads are still unresolved. An alert icon shows when the PR has merge conflicts.

## Requirements

- The [GitHub CLI](https://cli.github.com/), logged in:

  ```bash
  gh auth login
  ```

## Install

Put this folder at `~/.config/omarchy/plugins/lucas.gh-prs/`, then:

```bash
omarchy-shell shell rescanPlugins
omarchy plugin enable lucas.gh-prs --section right
```

## Settings

Click the gear in the popup header to change the settings. Changes apply right away. You can also set them on the widget's entry in `~/.config/omarchy/shell.json`:

| Key | Default | Meaning |
| --- | --- | --- |
| `refreshIntervalSec` | `10` | Seconds between GitHub queries, from 5 to 3600. |
| `aiCheckNames` | `"CodeRabbit"` | Comma-separated AI check patterns: parts of check names that mark an AI code review. When every such check on a PR has finished, its row shows a robot icon and you get a notification. Leave it empty to turn this off. |
| `notificationsEnabled` | `true` | Turn off to stop every notification. |
| `notifyAiReviewDone` | `true` | Notify when the AI review is done. |
| `notifyCiPassed` | `true` | Notify when CI passed. |
| `notifyCiFailed` | `true` | Notify when CI failed. |
| `notifyApproved` | `true` | Notify when a PR is approved. |
| `notifyChangesRequested` | `true` | Notify when changes are requested. |
| `notifyCodeComments` | `true` | Notify when someone else writes new code comments on your PR. |
| `notifyMerged` | `true` | Notify when someone else merges your PR. |
| `notifyClosed` | `true` | Notify when someone else closes your PR. |

## Development

- `js/prs.js` holds the logic: the GraphQL query, the status rules, grouping, and theme colors.
- `Panel.qml` holds the bar badge and the popup, and `SettingsView.qml` holds the popup's settings page.
- Run the tests:

  ```bash
  node --test tests/prs.test.js
  ```

- Saving a file does not reliably reload the running widget. Run `omarchy restart shell` to see QML changes.

The spec lives in `.agent/scratch/gh-prs/spec.md`, and the domain terms are defined in `.agent/GLOSSARY.md`.

# Ideas
- Add a refresh button
- Add a `filter out prs with more then X days old` and add that to settings page so user can chose. It can be null, if it's null we don't filter out nothing. We should add one for authored and other for the to review
