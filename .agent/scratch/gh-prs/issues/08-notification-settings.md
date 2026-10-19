# 08 - Notification settings

Status: resolved

Blocked by: 05

Spec: `../spec.md`, section "Settings", subsections "Notifications" and "Manifest".

## What

Let the user turn all notifications off, or turn each of `AI review done`, `CI passed`, and `CI failed` on or off.

## Acceptance criteria

- [x] New settings, all `true` by default: `notificationsEnabled`, `notifyAiReviewDone`, `notifyCiPassed`, `notifyCiFailed`. Added to `manifest.json` `defaults` and `schema` as `boolean`.
- [x] The Notifications section shows the master switch and, indented under it, the three toggles. Each saves on click.
- [x] When the master switch is off, the three toggles are greyed out and cannot be changed, but keep their saved values.
- [x] A notification is sent only when the master switch and its own toggle are both on.
- [x] `lastPrs` is still updated on every successful poll, whatever the toggles say, so turning a notification back on sends nothing old.
- [x] The decision "should this notification be sent" is a pure function in `js/prs.js`, tested for: master off, each toggle off, all on, and a missing key falling back to `true`.
- [x] README updated: the notification paragraph and the "Settings" table.

## Comments

Implemented on branch `settings-page`.
