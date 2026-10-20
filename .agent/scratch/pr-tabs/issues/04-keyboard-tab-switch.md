# 04 - Switch Tabs from the keyboard

Status: resolved

Blocked by: 02

Spec: `../spec.md`, section "Modules and interfaces".

## What

`h`/`l` and Left/Right switch between the Tabs. Tab and Shift+Tab still switch bar panels.

## Acceptance criteria

- [x] Right or `l` selects To review, and left or `h` selects Authored.
- [x] The keys do nothing while Settings is open.
- [x] Tab and Shift+Tab still switch bar panels, and Escape still closes Settings or the popup.
- [x] The README and the living spec list the keys.
- [x] The tests and `qmllint` pass.

## Notes

- QML only, so there is no automated test. Hand check after `omarchy restart shell`.

## Comments

- Implemented on branch `pr-tabs`. The hand check after `omarchy restart shell` is left to the user.
