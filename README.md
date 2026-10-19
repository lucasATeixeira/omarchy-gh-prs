# GitHub PRs

An Omarchy bar widget that shows the CI status of your open GitHub pull requests.

The bar shows the GitHub icon with a badge: the worst CI status among your PRs and how many PRs have it. Red means a check failed, yellow means checks are still running, and green means every check passed. Click it to see every PR grouped into Failing, Running, Passing, and No CI. Click a PR to open it in the browser.

When a PR's checks stop running and pass or fail, you get a notification. Click it to open the PR.

A PR's row shows a check icon when the PR is approved, and a document icon when changes are requested. A comment icon with a number shows how many review threads are still unresolved.

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

Set these on the widget's entry in `~/.config/omarchy/shell.json`:

| Key | Default | Meaning |
| --- | --- | --- |
| `refreshIntervalSec` | `10` | Seconds between GitHub queries. |
| `aiCheckNames` | `"CodeRabbit"` | Comma-separated parts of check names that mark an AI code review. When every such check on a PR has finished, its row shows a robot icon and you get a notification. |

## Development

- `js/prs.js` holds the logic: the GraphQL query, the status rules, grouping, and theme colors.
- `Panel.qml` holds the bar badge and the popup.
- Run the tests:

  ```bash
  node --test tests/prs.test.js
  ```

- Saving a file does not reliably reload the running widget. Run `omarchy restart shell` to see QML changes.

The spec lives in `.agent/scratch/gh-prs/spec.md`, and the domain terms are defined in `.agent/GLOSSARY.md`.
