# 01 - CI finished notification

Status: ready-for-agent

Spec: `../spec.md`, section "CI notification".

## What

Send a desktop notification when a PR's **CI finished**: its Status was `running` in the last successful poll and is `failing` or `passing` now.

## Acceptance criteria

- [ ] A pure function in `js/prs.js`, next to `finishedAiReviews`, returns the PRs whose CI finished between the previous and the current poll.
- [ ] Only `running` → `failing` and `running` → `passing` count.
- [ ] No result on the first poll (previous PRs are null) or for a PR missing from the previous poll.
- [ ] `Panel.qml` sends one notification per PR: title `CI passed` or `CI failed`, body `owner/repo#123 — <PR title>`, click opens the PR.
- [ ] The AI review notification still fires on its own; both can fire for the same PR in one poll.
- [ ] A failed poll sends nothing and does not replace `lastPrs`.
- [ ] Tests in `tests/prs.test.js` cover: each counted change, each ignored change (`passing` → `failing`, `failing` → `passing`, `running` → `none`, `running` → `running`), first poll, and a new PR.

## Notes

- Reuse the shape of `finishedAiReviews` and `notifyAiReviewDone`. Consider sharing the "match by URL with the previous poll" logic instead of copying it.
