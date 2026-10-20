# 04 - Switch Tabs from the keyboard

Status: ready-for-agent

Blocked by: 02

Spec: `../spec.md`, section "Modules and interfaces".

## What

`h`/`l` and Left/Right switch between the Tabs. Tab and Shift+Tab still switch bar panels.

## Acceptance criteria

- [ ] Right or `l` selects To review, and left or `h` selects Authored.
- [ ] The keys do nothing while Settings is open.
- [ ] Tab and Shift+Tab still switch bar panels, and Escape still closes Settings or the popup.
- [ ] The README and the living spec list the keys.
- [ ] The tests and `qmllint` pass.

## Notes

- QML only, so there is no automated test. Hand check after `omarchy restart shell`.
