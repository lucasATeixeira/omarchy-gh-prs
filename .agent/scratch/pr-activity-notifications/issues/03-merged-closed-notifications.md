# 03 - Details query, and merged and closed notifications

Status: ready-for-agent

Blocked by: 01

Spec: `../spec.md`, sections "Data: two steps", "Notification rules" (Merged and Closed), and "Settings".

## What

Notify when someone else **Merged** or **Closed** one of my PRs. When a PR disappears from the list, a second, small query reads its real state and who changed it.

## Acceptance criteria

- [ ] The main query also reads each PR's node id and the viewer's login. Its cost stays at 2 points, checked with `rateLimit(dryRun: true)`.
- [ ] A pure function returns the PR ids that need details. In this ticket, those are the PRs in the previous successful poll that are missing from the current one. It returns nothing on the first poll.
- [ ] The details query is one `nodes(ids: ...)` query. It reads each PR's state, who merged it, and the actor of its latest close event. A typed details result holds them.
- [ ] A parse function for one details run, shaped like `parseRun`: exit code, stdout, and stderr in; details or an error out.
- [ ] The panel runs the details query only when some PR needs details, then calls the main seam with the details. A new poll does not start while either query runs.
- [ ] The main seam returns `PR merged by <login>` for `MERGED`, and `PR closed by <login>` for `CLOSED`. The body uses the PR data from the previous poll. Clicking opens the PR.
- [ ] Nothing is sent when the viewer merged or closed the PR, or when the state is still `OPEN`.
- [ ] If the details query fails, the merged and closed notifications of that poll are skipped. The other notifications of the poll are still sent, and the PR list still updates.
- [ ] New settings `notifyMerged` and `notifyClosed`, both `true` by default. Added to the manifest with the labels "Notify when a PR is merged" and "Notify when a PR is closed".
- [ ] Two toggles in the settings page under the master switch: "PR merged" and "PR closed".
- [ ] Tests cover: `parseRun` reading the id and viewer login; the "needs details" function for unchanged, missing, and new PRs and the first poll; the details parse function for success, a `gh` failure, and a broken response; each notifying and skipped case in the main seam; failed details; and `notificationEnabled` for the two new keys.
- [ ] README and the living spec `../../gh-prs/spec.md`: Settings, the Data section, and Known limits. The new limits are: a failed details query loses these notifications, and nothing is sent for a PR merged during the poll right after the AI check patterns change.
