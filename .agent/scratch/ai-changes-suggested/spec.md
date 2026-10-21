# Spec: Robot icon only for AI changes suggested

Status: ready-for-agent

## Problem Statement

The robot icon appears on a PR row as soon as the **AI review is done**, whatever the AI reviewer found. Most AI reviews end with nothing to fix, so the robot shows on almost every row and tells the user nothing. The "AI review done" notification has the same problem: it does not say if the AI found anything.

The AI Check result cannot tell the two cases apart. CodeRabbit always reports its Check as `SUCCESS` ("Review completed"), and its Review is always `COMMENTED`, even when it finds problems. When it finds problems, it opens review threads as the user `coderabbitai`. When it finds nothing, it opens no threads.

## Solution

The robot icon marks only PRs with **AI changes suggested**: the AI review is done and the PR has at least one **AI thread**, an Unresolved thread whose first comment is from an **AI reviewer**. An AI reviewer is any user whose login matches an AI check pattern, so the default pattern `CodeRabbit` matches `coderabbitai`.

The notification still fires once, when the AI review becomes done, under the existing "AI review done" toggle. Its title says the result:

- **AI review: changes suggested** when the PR has at least one AI thread.
- **AI review: no changes suggested** when it has none.

## User Stories

1. As a PR author, I want the robot icon only on PRs where the AI suggested changes, so that the icon points me to work I still need to do.
2. As a PR author, I want no robot icon when the AI review finished with no suggestions, so that clean PRs look clean.
3. As a PR author, I want the robot icon to go away when I resolve every AI thread, so that the icon means "AI feedback still waiting for me".
4. As a PR author, I want an unresolved AI thread from an earlier commit to keep the robot icon, so that I do not forget feedback I have not handled.
5. As a PR author, I want the robot icon to hide while a new AI review runs after a new commit, so that the icon always reflects the latest finished AI review.
6. As a PR author, I want the robot icon to come back when the new AI review finishes and AI threads are still unresolved, so that old feedback is not lost.
7. As a PR author, I want threads opened by humans to never show the robot icon, so that the icon is only about AI feedback.
8. As a PR author, I want a resolved AI thread to not count, so that handled feedback does not show the robot icon.
9. As a PR author, I want a thread where the AI only replied to a human's comment to not count, so that only threads the AI started show the robot icon.
10. As a PR author, I want the AI reviewer to be found with my existing AI check patterns, so that I do not configure the AI twice.
11. As a PR author, I want pattern matching on logins to ignore case, so that `CodeRabbit` matches `coderabbitai`.
12. As a PR author, I want no robot icon and no AI notifications when I have no AI check patterns, so that the feature stays off until I set it up.
13. As a PR author, I want a thread whose first comment is from a deleted account to not count as an AI thread, so that ghost users never trigger the robot icon.
14. As a PR author, I want the robot icon to have no count next to it, so that the row stays simple; the unresolved thread icon already shows a count.
15. As a reviewer, I want the same robot icon rule on the To review Tab, so that both Tabs mean the same thing.
16. As a PR author, I want the notification "AI review: changes suggested" when the AI review finishes with AI threads, so that I know I have work to do without opening the popup.
17. As a PR author, I want the notification "AI review: no changes suggested" when the AI review finishes with no AI threads, so that I know the PR is clean from the AI's side.
18. As a PR author, I want both AI notifications under the existing "AI review done" toggle, so that my current settings keep working.
19. As a PR author, I want only one AI notification per finished AI review, so that I am not notified twice for the same review.
20. As a PR author, I want no notification when the robot icon appears later, for example when an AI thread is reopened, so that notifications stay tied to the AI review finishing.
21. As a PR author, I want no AI notifications on the first poll, so that starting the shell does not send a burst of notifications, as today.

## Implementation Decisions

- **Domain terms** are in the glossary: AI check pattern now also matches logins, plus the new terms AI reviewer, AI thread, and AI changes suggested.
- **Main query**: each review thread also reads the author login of its first comment, next to `isResolved`. No new query and no change to the details query.
- **PullRequest model**: gets a new boolean field, `aiChangesSuggested`. It is true when `aiReviewDone` is true and at least one thread is unresolved and its first comment's author login contains an AI check pattern, ignoring case. `aiReviewDone` stays, because the notification still fires on its transition.
- **Pattern matching**: matching a Check name and matching a login use the same rule, so it should be one shared function that takes a name and the lowercase patterns. The existing AI Check filter should use it too.
- **Deleted accounts**: a missing comment author becomes the login `ghost`, as everywhere else. A pattern could match `ghost` only if the user typed one that does, which we accept.
- **Notifications**: the trigger does not change: the AI review was not done in the previous poll and is done now. The title depends on `aiChangesSuggested` in the current poll. Both titles use the `notifyAiReviewDone` setting. The notification still applies to the same PRs as today.
- **Row icon**: the robot icon is visible when `aiChangesSuggested` is true, instead of `aiReviewDone`. It shows no count.
- **Settings text**: the empty patterns text ("The robot icon and AI review notifications are off.") stays true and does not change. The toggle label "AI review done" does not change.
- **Accepted timing risk**: if an AI reviewer marks its Check as finished before its threads are visible, one poll may see "done, no AI threads". The user would then get "AI review: no changes suggested" by mistake, and the robot would appear on the next poll without a notification. We accept this and fix it only if it happens.

## Testing Decisions

- Tests check external behavior only, through two existing seams in the JS module. They do not call private helpers.
- **`parseRun` seam**: build raw `gh` JSON and assert `aiChangesSuggested` on the returned PR. Cases:
  - AI review done with one unresolved AI thread: true.
  - AI review done with only resolved AI threads: false.
  - AI review done with unresolved threads from humans only: false.
  - A thread started by a human with an AI reply: false.
  - AI threads present but the AI review is not done: false.
  - Login matching ignores case.
  - No AI check patterns: false.
  - A thread whose first comment has no author: false with the default pattern.
  - The same rule for PRs to review.
  - Prior art: the `parseRun AI review` and `parseRun unresolved threads` tests.
- **`pollNotifications` seam**: assert the title and setting of the AI notification. Cases:
  - Done with AI changes suggested: "AI review: changes suggested", setting `notifyAiReviewDone`.
  - Done with none: "AI review: no changes suggested", setting `notifyAiReviewDone`.
  - `aiChangesSuggested` turns true while the AI review was already done: no AI notification.
  - Prior art: the existing `pollNotifications` tests.
- **`QUERY` test**: assert the query reads the first comment's author login for each review thread.
- **Row icon**: the QML has no automated tests. The hand check before merge covers it.
- Existing tests that build PRs or thread nodes may need the new field or the new thread shape in their fixtures. Do not weaken any assertion.

## Out of Scope

- A count next to the robot icon.
- Waiting an extra poll before the AI notification to avoid the timing risk.
- Notifying when the robot icon appears or disappears after the AI review is done.
- A separate setting for AI reviewer logins.
- A separate toggle for each of the two AI notification titles.
- Using the AI Check result or the AI's Review state as the signal.

## Further Notes

- Facts come from 10 of the user's recent PRs with CodeRabbit, read on 2026-10-21. The Check was always `SUCCESS`, the Review was always `COMMENTED`, and PRs with no findings had no CodeRabbit Review and no threads.
- Update the main spec (`.agent/scratch/gh-prs/spec.md`) and the README where they describe the robot icon and the "AI review done" notification.
