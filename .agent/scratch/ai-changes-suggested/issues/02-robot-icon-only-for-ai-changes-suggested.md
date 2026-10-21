# 02: Robot icon only for AI changes suggested

**What to build:** the robot icon marks only PRs with AI changes suggested: the AI review is done and the PR has at least one AI thread. An AI thread is an Unresolved thread whose first comment is from an AI reviewer, a user whose login matches an AI check pattern. A PR whose AI review finished with no AI threads shows no robot. The rule is the same on both Tabs. See `../spec.md` for the full rules and cases.

**Blocked by:** 01 (Share the AI pattern match).

**Status:** ready-for-agent

- [ ] The main query reads the author login of each review thread's first comment.
- [ ] Each PR has an `aiChangesSuggested` field, true only when the AI review is done and at least one AI thread exists.
- [ ] AI reviewers are found with the shared pattern match from 01.
- [ ] Resolved AI threads, threads started by humans, and threads whose first author is a deleted account do not count.
- [ ] No AI check patterns means `aiChangesSuggested` is always false.
- [ ] The robot icon shows when `aiChangesSuggested` is true, with no count.
- [ ] `parseRun` tests cover every case listed in the spec, for Authored PRs and PRs to review.
- [ ] The `QUERY` test asserts the new thread author field.
- [ ] The main spec and the README describe the new robot rule. Keep the README's other uncommitted changes.
- [ ] Hand check: a PR with a clean AI review shows no robot; a PR with an unresolved AI thread shows it.
