# Glossary

**Check**: one CI result on a PR's latest commit. In the GitHub API it is a `CheckRun` (GitHub Actions and apps) or a `StatusContext` (commit statuses). _Avoid_: job, build.

**AI Check**: a Check made by an AI code reviewer, such as CodeRabbit. The user chooses which Checks are AI Checks by name. An AI Check still counts toward its PR's Status like any other Check. _Avoid_: AI review, bot review.

**AI review done**: a PR whose latest commit has at least one AI Check, and every AI Check on it has finished, with any result. A new commit makes the PR not done again.

**Status**: the CI state of a Check or a PR. One of `failing`, `running`, `passing`, or `none`. A PR's Status is the worst Status among its Checks; `none` means it has no Checks. _Avoid_: state, result, color.

**Worst Status**: the first Status present in the order `failing` > `running` > `passing` > `none`.

**Bar summary**: the worst Status among all PRs, plus how many PRs have it. A Bar summary of `none` has a count of 0.

**Badge**: the colored disc on the GitHub icon in the bar that shows the Bar summary, or `✕` on error. _Avoid_: indicator, pill.

**Section**: a titled group of PRs in the popup that share one Status. Titles: Failing, Running, Passing, No CI.

**Status dot**: the small colored circle that shows a Status in a Section header or a PR row.

**CI finished**: a PR whose Status changed from `running` to `failing` or `passing` between two successful polls. _Avoid_: CI done, build finished.

**Review decision**: GitHub's overall review verdict for a PR: approved, changes requested, or review required. _Avoid_: review status, approval state.

**Conflict**: a PR that GitHub says cannot merge because its branch conflicts with the base branch. _Avoid_: merge error.

**Unresolved thread**: a review comment thread on a PR's code that nobody has marked as resolved. _Avoid_: open comment, pending comment.
