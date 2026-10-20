# 04 - Code comment notifications

Status: ready-for-agent

Blocked by: 03

Spec: `../spec.md`, sections "Data: two steps", "Notification rules" (Code comment), and "Settings".

## What

Notify when someone else writes new **Code comments** on one of my PRs: a new review thread, or a reply in any thread, resolved or not. Many comments in one poll give one notification.

## Acceptance criteria

- [ ] First, check the spec's ASSUMPTION on a real PR: a new Code comment changes the PR's `updatedAt`. Write the result in this ticket's Comments. If it is false, stop and tell the user before going on.
- [ ] A PR also needs details when it was in the previous poll and its `updatedAt` changed.
- [ ] The details query also reads, for each review thread, the latest comments with author login and `publishedAt`. A typed Code comment holds them.
- [ ] The main seam counts a PR's comments with `publishedAt` later than its `updatedAt` in the previous poll, and whose author is not the viewer. Bot authors count.
- [ ] One notification per PR per poll. Title `New code comment from <login>` for one comment, `<n> new code comments` for more. Body: `owner/repo#123 — <PR title>`. Clicking opens the PR.
- [ ] A Review notification and a Code comment notification for the same PR in the same poll are both sent.
- [ ] Nothing is sent on the first poll, for a PR seen for the first time, or when the details query fails.
- [ ] Each poll that needs details stays cheap: about 1 point per PR, checked with `rateLimit(dryRun: true)`.
- [ ] New setting `notifyCodeComments`, `true` by default. Added to the manifest with the label "Notify on new code comments".
- [ ] One toggle in the settings page under the master switch: "New code comments".
- [ ] Tests cover: the "needs details" function for a changed PR; the details parse function reading comments; one comment, many comments, own comments only, a bot comment, a reply in a resolved thread, a comment published before the previous poll, and a Review with comments in the same poll; and `notificationEnabled` for the new key.
- [ ] README and the living spec `../../gh-prs/spec.md`: Settings, the Data section, and Known limits. The new limits are: only the first 100 review threads and the latest comments of each thread are read, and a comment that does not change `updatedAt` is missed.
