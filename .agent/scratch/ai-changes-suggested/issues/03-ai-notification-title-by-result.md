# 03: AI notification title by result

**What to build:** the notification sent when the AI review becomes done says what the AI found. It is "AI review: changes suggested" when the PR has AI changes suggested, and "AI review: no changes suggested" otherwise. Both use the existing "AI review done" toggle. The trigger does not change. See `../spec.md`.

**Blocked by:** 02 (Robot icon only for AI changes suggested).

**Status:** resolved

- [x] Done with AI changes suggested sends "AI review: changes suggested" with setting `notifyAiReviewDone`.
- [x] Done without them sends "AI review: no changes suggested" with setting `notifyAiReviewDone`.
- [x] `aiChangesSuggested` turning true while the AI review was already done sends no AI notification.
- [x] `pollNotifications` tests cover these three cases.
- [x] The main spec and the README describe the two titles. Keep the README's other uncommitted changes.
