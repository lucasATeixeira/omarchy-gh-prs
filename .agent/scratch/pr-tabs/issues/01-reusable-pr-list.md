# 01 - Make the PR list reusable

Status: resolved

Blocked by: None (can start immediately)

Spec: `../spec.md`, section "Implementation Decisions", subsection "Modules and interfaces".

## What

A prefactor with no visible change. The popup's PR list becomes one QML component that takes a list of PRs and an empty-state text. It shows the error, the empty text, the Sections, and the rows. The popup uses it once for the Authored PRs, so the next ticket can add a second list with one more instance.

## Acceptance criteria

- [x] One component shows the error, the empty text, the Sections, and the rows for the PRs it gets.
- [x] The popup uses it for the Authored PRs with the text "No open pull requests".
- [x] Rows, icons, hover, click, scrolling, and Settings work as before.
- [x] The tests and `qmllint` pass.

## Notes

- Hand check after `omarchy restart shell`: the popup looks and works exactly as before.

## Comments

- Implemented on branch `pr-tabs`. The hand check after `omarchy restart shell` is left to the user.
