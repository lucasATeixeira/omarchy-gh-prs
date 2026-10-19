# Glossary

**Check**: one CI result on a PR's latest commit. In the GitHub API it is a `CheckRun` (GitHub Actions and apps) or a `StatusContext` (commit statuses). _Avoid_: job, build.

**Status**: the CI state of a Check or a PR. One of `failing`, `running`, `passing`, or `none`. A PR's Status is the worst Status among its Checks; `none` means it has no Checks. _Avoid_: state, result, color.

**Worst Status**: the first Status present in the order `failing` > `running` > `passing` > `none`.

**Bar summary**: the worst Status among all PRs, plus how many PRs have it. A Bar summary of `none` has a count of 0.

**Badge**: the colored disc on the GitHub icon in the bar that shows the Bar summary, or `✕` on error. _Avoid_: indicator, pill.

**Section**: a titled group of PRs in the popup that share one Status. Titles: Failing, Running, Passing, No CI.

**Status dot**: the small colored circle that shows a Status in a Section header or a PR row.
