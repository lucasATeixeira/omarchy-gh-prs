# 02 - Review notifications

Status: resolved

Blocked by: 01

Spec: `../spec.md`, sections "Notification rules" (Review) and "Settings".

## What

Notify when a reviewer submits a **Review** that approves the PR or requests changes. This works in every repo, also in repos that do not require reviews.

## Acceptance criteria

- [x] The main query also reads each reviewer's latest Review: review id, state, and author login. Its cost stays at 2 points, checked with `rateLimit(dryRun: true)`.
- [x] `PullRequest` gets its latest Reviews, with a typed Review.
- [x] The main seam returns one notification per new Review: a Review id that was not in the same PR's latest Reviews in the previous poll.
- [x] Titles: `Approved by <login>` for `APPROVED`, `Changes requested by <login>` for `CHANGES_REQUESTED`. Body: `owner/repo#123 — <PR title>`. Clicking opens the PR.
- [x] No notification for `COMMENTED` or `DISMISSED` Reviews, on the first poll, or for a PR seen for the first time.
- [x] A second approval from the same reviewer after a new commit notifies again.
- [x] Two reviewers in the same poll give two notifications.
- [x] New settings `notifyApproved` and `notifyChangesRequested`, both `true` by default. Added to the manifest `defaults` and `schema` as `boolean`, with the labels "Notify when a PR is approved" and "Notify when changes are requested".
- [x] Two toggles in the settings page under the master switch, after the existing three: "PR approved" and "Changes requested".
- [x] Tests cover: `parseRun` reading latest Reviews; each notifying case; each skipped case; a second approval; two reviewers; and `notificationEnabled` for the two new keys, including a missing key.
- [x] README: the notification paragraph and the settings table. The living spec `../../gh-prs/spec.md`: Settings and the line "No notifications for review decision, threads, or conflicts".

## Notes

- The Review decision row icon does not change. It still comes from `reviewDecision`.

## Comments

- Implemented on branch `ticket-02-review-notifications`. Main query cost measured at 2 with `rateLimit(dryRun: true)`. The hand check of the QML after `omarchy restart shell` is left to the user.
