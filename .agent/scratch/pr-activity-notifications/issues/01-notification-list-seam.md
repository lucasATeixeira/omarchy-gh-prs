# 01 - One list of notifications per poll

Status: resolved

Blocked by: None (can start immediately)

Spec: `../spec.md`, section "Implementation Decisions", subsection "Modules and interfaces".

## What

A prefactor with no visible change. The decision "which notifications does this poll send" moves into one pure function, the main seam. The panel sends what it returns and keeps no notification rules of its own. Later tickets add new notification types to this function only.

## Acceptance criteria

- [x] A typed notification: its setting key, its title, and its PR.
- [x] One pure function takes the previous PRs, the current PRs, the details, and the viewer login, and returns the notifications to send. For now it returns the AI review and CI notifications by calling the existing functions. Details and viewer login are not used yet, but the signature is final.
- [x] The panel calls this function once per successful poll and sends each notification whose setting is on. It picks the icon from the setting key.
- [x] The behavior is the same as before: same titles, bodies, click action, and switches. Both notifications are still sent when the AI review is done and CI finished in the same poll.
- [x] New tests cover the seam for the existing notifications: AI review done, CI passed, CI failed, both in one poll, first poll, and a new PR.
- [x] Existing tests stay unchanged and pass.

## Notes

- Hand check after `omarchy restart shell`: a running PR still notifies when CI finishes.

## Comments

- Implemented on branch `ticket-01-notification-list-seam`. The hand check after `omarchy restart shell` is left to the user.
