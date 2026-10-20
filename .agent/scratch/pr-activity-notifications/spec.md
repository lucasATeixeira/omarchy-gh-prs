# Spec: PR activity notifications

Status: ready-for-agent

## Problem Statement

The widget tells me when CI finishes and when the AI review is done. But the most important events on my PRs come from people. A reviewer approves, a reviewer requests changes, someone writes a **Code comment**, or a teammate merges or closes my PR. Today I only learn about these when I open GitHub or read my email. So I react late, and my PR waits for me without any reason.

## Solution

The widget sends a desktop notification for five more events on my open PRs:

- A reviewer submits a **Review** that approves the PR.
- A reviewer submits a Review that requests changes.
- Someone else writes new Code comments on the PR.
- Someone else **Merged** the PR.
- Someone else **Closed** the PR.

Each event has its own switch in the Settings page, under the existing master switch. All five are on by default. Clicking a notification opens the PR, like the notifications that exist today.

The widget stays cheap on the GitHub API. The main poll costs the same as today. A second, small query runs only for PRs that changed or disappeared since the last poll.

## User Stories

1. As a PR author, I want a notification when a reviewer approves my PR, so that I can merge it without checking GitHub.
2. As a PR author, I want the approval notification to name the reviewer, so that I know who approved without opening the PR.
3. As a PR author, I want a notification when a reviewer requests changes, so that I can start the fixes early.
4. As a PR author, I want the changes-requested notification to name the reviewer, so that I know whom to talk to.
5. As a PR author in a repo that does not require reviews, I want approval notifications too, so that the feature works in every repo.
6. As a PR author, I want a new notification when the same reviewer approves again after a new commit, so that I know the latest code is approved.
7. As a PR author, I want no notification for a Review that only has comments, so that the approval notifications stay meaningful.
8. As a PR author, I want no notification for a dismissed Review, so that old verdicts do not come back.
9. As a PR author, I want one notification per Review when two reviewers approve at the same time, so that I see each reviewer's name.
10. As a PR author, I want a notification when someone writes a Code comment on my PR, so that I can answer while the reviewer is still there.
11. As a PR author, I want a notification for a new reply in an existing thread, so that I do not miss the answer to my own question.
12. As a PR author, I want a notification for a new reply in a resolved thread, so that I see when someone reopens a discussion.
13. As a PR author, I want no notification for my own Code comments, so that I am not told about what I just wrote.
14. As a PR author, I want Code comments from bots to notify too, so that I also see comments from tools like CodeRabbit.
15. As a PR author, I want many new Code comments on one PR to give one notification, so that a large review does not fill my screen.
16. As a PR author, I want a single new Code comment to name its author, so that I know who wrote it.
17. As a PR author, I want the Review notification and the Code comment notification to both arrive when a reviewer submits both, so that each switch keeps its meaning.
18. As a PR author, I want a notification when a teammate merges my PR, so that I know my work landed.
19. As a PR author, I want a notification when someone closes my PR without merging it, so that I can ask why.
20. As a PR author, I want the merged and closed notifications to name who did it, so that I know whom to ask.
21. As a PR author, I want no notification when I merge or close my own PR, so that I am not told about what I just did.
22. As a PR author, I want no merged or closed notification when a PR only fell out of the 50 most recently updated PRs, so that I only get true events.
23. As a PR author, I want a switch for each of the five new notifications, so that I can turn off the ones I do not need.
24. As a PR author, I want the five new switches to follow the master switch, so that one click still turns every notification off.
25. As a PR author, I want the five new switches to be on by default, so that the feature works after an update without setup.
26. As a PR author, I want to set the five new switches in `shell.json` by hand too, so that I can keep my config in my dotfiles.
27. As a PR author, I want no notifications for old events when the widget starts, so that a restart does not flood my screen.
28. As a PR author, I want no notifications for old events on a PR that I see for the first time, so that a new PR does not flood my screen.
29. As a PR author, I want turning a switch back on to send nothing old, so that the switch only affects future events.
30. As a PR author, I want the widget to stay far below GitHub's API limit at any refresh interval, so that `gh` keeps working in my other tools.
31. As a PR author, I want a failed second query to send nothing and to not break the PR list, so that a network problem only costs a few notifications.
32. As a PR author, I want clicking any new notification to open the PR in the browser, so that it works like the existing notifications.

## Implementation Decisions

### Data: two steps

- Measured with `rateLimit(dryRun: true)`: the current main query costs 2 points. Adding the comments of every review thread makes it cost 52 points. At the default 10s interval that is about 18,700 points per hour, and the limit is 5000. So the widget reads Code comments only in a second query.
- **Main poll** (stays at 2 points, measured): the existing query also reads the PR's node `id`, each reviewer's latest Review (`latestReviews`: review id, state, author login), and the viewer's login.
- **Details query**: one `nodes(ids: ...)` query for the PR ids that need details. It reads the PR `state` (`OPEN`, `MERGED`, `CLOSED`), who merged it (`mergedBy`), who closed it (the actor of the latest `ClosedEvent`), and for each review thread the latest comments with author login and `publishedAt`. It costs about 1 point per PR, measured.
- A PR needs details when it was in the previous successful poll and either its `updatedAt` changed, or it is missing from the current poll.
- No details query runs when no PR needs details, or on the first poll.
- A new poll does not start while the main query or the details query is still running.
- ASSUMPTION: a new Code comment changes the PR's `updatedAt`. The first ticket checks this on a real PR.

### Notification rules

- **Review**: a Review in the current poll whose id was not in the same PR's latest Reviews in the previous poll, and whose state is `APPROVED` or `CHANGES_REQUESTED`. One notification per Review. Titles: `Approved by <login>` and `Changes requested by <login>`.
- **Code comment**: a comment from the details query with `publishedAt` later than the PR's `updatedAt` in the previous poll, and whose author is not the viewer. Threads count whether resolved or not. Bot authors count. One notification per PR per poll. Title: `New code comment from <login>` for one comment, `<n> new code comments` for more.
- **Merged** and **Closed**: a PR missing from the current poll whose details state is `MERGED` or `CLOSED`, and whose actor is not the viewer. Titles: `PR merged by <login>` and `PR closed by <login>`. A PR whose state is still `OPEN` sends nothing.
- The body of every notification stays `owner/repo#123 — <PR title>`. For a Merged or Closed PR, the PR data comes from the previous poll.
- Existing rules still apply to all five: nothing on the first poll, nothing for a PR seen for the first time, a failed main poll does not change the last seen PRs, and drafts are included.
- If the details query fails, the Code comment, Merged, and Closed notifications of that poll are skipped. The main poll's notifications are still sent.

### Modules and interfaces

- **The PR logic module** (the pure JavaScript file next to the QML) gains:
  - `PullRequest` gets `id` and `latestReviews`. `FetchResult` gets the viewer login.
  - A typed `Review` (id, state, author), a typed `PrDetails` (id, state, actor, Code comments), and a typed `CodeComment` (author, published time).
  - A function that returns the PR ids that need details, from the previous and the current poll.
  - The details query, and a parse function for one details run, shaped like `parseRun`: exit code, stdout, stderr in; details or an error out.
  - **The main seam**: one function that takes the previous PRs, the current PRs, the details, and the viewer login, and returns the list of notifications to send. Each notification is typed: its setting key, its title, and its PR. It covers the existing AI review and CI notifications too, by calling the existing functions.
  - `NotificationSetting` and `WidgetSettings` get the five new keys.
- **The panel QML**: after the main poll, it runs the details query when needed. Then it calls the main seam once and sends each notification whose setting is on. It keeps no notification rules of its own. It chooses an icon per setting key.
- **The settings view QML**: five new toggles under the master switch, after the three existing ones, with the same greyed-out behavior.

### Settings

| Key | Default | Label |
| --- | --- | --- |
| `notifyApproved` | `true` | Notify when a PR is approved |
| `notifyChangesRequested` | `true` | Notify when changes are requested |
| `notifyCodeComments` | `true` | Notify on new code comments |
| `notifyMerged` | `true` | Notify when a PR is merged |
| `notifyClosed` | `true` | Notify when a PR is closed |

- All five go into the manifest's `defaults` and `schema` as `boolean`, and into the README settings table.
- A missing key counts as on, like the existing notification keys.

### Docs

- The living spec (`../gh-prs/spec.md`) currently says "No notifications for review decision, threads, or conflicts." It gets updated to point to this feature, and its Settings and Known limits sections get the new keys and limits.
- The README's notification paragraph and settings table are updated.

## Testing Decisions

- A good test calls a public function with plain data and checks what comes out. It does not check how the function works inside.
- The main seam is tested with previous and current PR lists, details, and a viewer login, and checks the list of notifications (setting key, title, PR). This covers every rule above: each new event, each skipped case (own comment, own merge, `OPEN` state, `COMMENTED` or `DISMISSED` Review, first poll, new PR, failed details), the single and many comment titles, and both a Review and comments in the same poll.
- The "PRs that need details" function is tested with unchanged, changed, missing, and new PRs, and the first poll.
- The details parse function is tested like `parseRun`: success, a `gh` failure, and a broken response.
- `parseRun` tests are extended for the new fields: PR id, latest Reviews, and viewer login.
- `notificationEnabled` tests cover the new keys, including a missing key that counts as on.
- Prior art: the existing tests in the test file for `parseRun`, `finishedCi`, `finishedAiReviews`, and `notificationEnabled`. They use `node:test` and load the QML library with the existing loader. Existing tests stay unchanged.
- The QML has no automated tests. Check it by hand after `omarchy restart shell`.

## Out of Scope

- Notifications for comments in the PR conversation that are not on code. They cannot be resolved and are not Code comments.
- Notifications for Reviews that only have comments, and for dismissed Reviews.
- A notification when a new review is requested from someone, or when the Review decision changes without a new Review.
- Notifications for PRs where I am a reviewer and not the author.
- Grouping several Reviews into one notification.
- Trying the details query again on the next poll after it fails.
- Changing the row icons, Sections, or the Badge.

## Further Notes

- New known limits:
  - Only the first 100 review threads of a PR are read, and only the latest comments of each thread.
  - If the details query fails, that poll's Code comment, Merged, and Closed notifications are lost.
  - A PR merged or closed during the poll right after the AI check patterns change sends nothing, because that poll forgets the last seen PRs.
  - A Code comment that does not change the PR's `updatedAt` is missed. See the ASSUMPTION above.
  - A Code comment published in the same second as the PR's previous `updatedAt` is missed, because timestamps have whole seconds.
- Glossary terms used here: Review, Code comment, Merged, Closed. They are defined in `.agent/GLOSSARY.md`.
