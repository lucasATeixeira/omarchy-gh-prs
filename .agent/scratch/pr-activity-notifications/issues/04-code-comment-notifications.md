# 04 - Code comment notifications

Status: resolved

Blocked by: 03

Spec: `../spec.md`, sections "Data: two steps", "Notification rules" (Code comment), and "Settings".

## What

Notify when someone else writes new **Code comments** on one of my PRs: a new review thread, or a reply in any thread, resolved or not. Many comments in one poll give one notification.

## Acceptance criteria

- [x] First, check the spec's ASSUMPTION on a real PR: a new Code comment changes the PR's `updatedAt`. Write the result in this ticket's Comments. If it is false, stop and tell the user before going on.
- [x] A PR also needs details when it was in the previous poll and its `updatedAt` changed.
- [x] The details query also reads, for each review thread, the latest comments with author login and `publishedAt`. A typed Code comment holds them.
- [x] The main seam counts a PR's comments with `publishedAt` later than its `updatedAt` in the previous poll, and whose author is not the viewer. Bot authors count.
- [x] One notification per PR per poll. Title `New code comment from <login>` for one comment, `<n> new code comments` for more. Body: `owner/repo#123 — <PR title>`. Clicking opens the PR.
- [x] A Review notification and a Code comment notification for the same PR in the same poll are both sent.
- [x] Nothing is sent on the first poll, for a PR seen for the first time, or when the details query fails.
- [x] Each poll that needs details stays cheap: about 1 point per PR, checked with `rateLimit(dryRun: true)`.
- [x] New setting `notifyCodeComments`, `true` by default. Added to the manifest with the label "Notify on new code comments".
- [x] One toggle in the settings page under the master switch: "New code comments".
- [x] Tests cover: the "needs details" function for a changed PR; the details parse function reading comments; one comment, many comments, own comments only, a bot comment, a reply in a resolved thread, a comment published before the previous poll, and a Review with comments in the same poll; and `notificationEnabled` for the new key.
- [x] README and the living spec `../../gh-prs/spec.md`: Settings, the Data section, and Known limits. The new limits are: only the first 100 review threads and the latest comments of each thread are read, and a comment that does not change `updatedAt` is missed.

## Comments

- `updatedAt` check, read-only on three real open PRs: the assumption holds. In each case `updatedAt` matches the newest review comment within 1 second, and no later timeline event exists.
  - PR A: new thread by a teammate at `2026-10-20T17:36:14Z`; `updatedAt` is `2026-10-20T17:36:14Z`.
  - PR B: reply in a resolved thread by a bot at `2026-10-14T13:15:50Z`; `updatedAt` is `2026-10-14T13:15:51Z`. The last other timeline event is a Review at `13:00:03Z`.
  - PR C: reply in an open thread by a bot at `2026-10-16T19:06:21Z`; `updatedAt` is `2026-10-16T19:06:22Z`. The last other timeline event is a Review at `18:30:26Z`.
- Details query cost with `rateLimit(dryRun: true)` and real PR ids: 1 point for 1 id, 5 points for 5 ids.
- Implemented on branch `ticket-04-code-comment-notifications`. The hand check of the QML after `omarchy restart shell` is left to the user.
