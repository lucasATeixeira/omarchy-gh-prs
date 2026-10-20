# Spec: Authored and To review Tabs

Status: ready-for-agent

## Problem Statement

The popup lists only my **Authored PRs**. I also review other people's PRs, but the widget does not show the PRs that wait for my **Review**. To find them I open GitHub or read my email. So I react late, and my teammates wait for me.

## Solution

Two **Tabs** sit right under the "Pull Requests" header: **Authored** and **To review**. Each title shows how many PRs it has, like `Authored 3` and `To review 2`.

- Authored shows the same list as today.
- To review lists the **PRs to review**: open PRs where GitHub waits for my Review, because someone asked me or one of my teams. It uses the same **Sections** as Authored. Each row also shows who wrote the PR.

I switch Tabs with the mouse, or with `h`/`l` and Left/Right. The popup remembers the last Tab while the shell runs.

The bar **Badge**, the **Bar summary**, and every notification stay about Authored PRs only. One fetch reads both lists, so the widget costs about the same on the GitHub API.

## User Stories

1. As a reviewer, I want a To review Tab in the popup, so that I see the PRs that wait for my Review without opening GitHub.
2. As a reviewer, I want To review to include requests to my teams, so that I do not miss reviews asked through a team.
3. As a reviewer, I want a PR to leave To review after I submit my Review, so that the list only shows work I still have to do.
4. As a reviewer, I want a PR to come back to To review when the author asks me again, so that I see when new code needs my eyes.
5. As a reviewer, I want To review grouped into the same Sections as Authored, so that I can wait for failing CI before I review.
6. As a reviewer, I want the newest PR first inside each Section, so that the same order works in both Tabs.
7. As a reviewer, I want each To review row to show the author's login, so that I know whose work I am reviewing.
8. As a reviewer, I want To review rows to show the same icons as Authored rows, so that I read both Tabs the same way.
9. As a reviewer, I want a PR by a deleted account to show `@ghost`, so that the row still works.
10. As a reviewer, I want "No PRs to review" when the list is empty, so that I know the fetch worked and nothing waits for me.
11. As a reviewer, I want clicking a To review row to open the PR in the browser and close the popup, so that it works like an Authored row.
12. As a user, I want the Tab titles to show counts, so that I see waiting reviews without opening the Tab.
13. As a PR author, I want the Authored Tab to show the same list as today, so that nothing I use changes.
14. As a user, I want to switch Tabs with the mouse, so that the Tabs work like buttons.
15. As a keyboard user, I want to switch Tabs with `h`/`l` and Left/Right, so that I never need the mouse.
16. As a keyboard user, I want Tab and Shift+Tab to still switch bar panels, so that the shell's keys keep working.
17. As a user, I want the popup to open on the last Tab I used while the shell runs, so that I can come back to where I was.
18. As a user, I want the popup to open on Authored after a shell restart, so that the start state is predictable.
19. As a user, I want the Tabs hidden while Settings is open, so that Settings keeps the whole popup.
20. As a user, I want `h`/`l` and Left/Right to do nothing while Settings is open, so that I do not switch a hidden Tab.
21. As a user, I want one error shown on both Tabs when the fetch fails, so that I know neither list is fresh.
22. As a PR author, I want the bar Badge to count only Authored PRs, so that it keeps one meaning: the state of my CI.
23. As a PR author, I want the header badge to count only Authored PRs, so that it matches the bar.
24. As a PR author, I want notifications only for Authored PRs, so that CI and Reviews on other people's PRs do not distract me.
25. As a user, I want both lists read in one poll at the same refresh interval, so that the widget stays cheap on the GitHub API.

## Implementation Decisions

### Data

- The main query gets a second named `search` block next to the existing one: `is:pr is:open review-requested:@me sort:updated-desc`, the first 50 results, with the same PR fields. `review-requested:@me` includes requests to the user's teams.
- Both search blocks read the PR author's login.
- One `gh api graphql` run still serves both lists, at the same refresh interval. A failed run gives one error for both lists.
- GitHub does not allow a review request to a PR's own author, so a PR is never in both lists. No code handles that case.

### Modules and interfaces

- **The PR logic module**:
  - `PullRequest` gets `author`, the login of who opened the PR. A deleted account is `ghost`, like other logins.
  - `FetchResult` gets `prsToReview`, the PRs to review, next to `prs`, which stays the Authored PRs. Both are empty on error.
  - `sections` and `barSummary` do not change. The panel passes `prsToReview` through `sections`.
- **The panel QML**:
  - The PR list becomes one reusable component. It takes a list of PRs and an empty-state text, and it shows the Sections, the rows, the empty text, and the error. One instance shows the PRs of the selected Tab.
  - The Tabs use the shell's existing `ButtonGroup`, under the header and above the separator. Titles: `Authored <n>` and `To review <n>`.
  - The selected Tab is a panel property. It starts on Authored and is not saved to settings.
  - The panel key catcher's move signal switches Tabs: right or `l` moves to To review, left or `h` moves to Authored. It is ignored while Settings is open.
  - To review rows show `@<author>` in muted text after `repo#number`. The title elides to make room. Authored rows do not change.
  - The Badge, the notifications, and the details query keep using only `prs`.
- **Glossary**: Authored PR, PR to review, and Tab are defined, and Bar summary counts only Authored PRs.

### Docs

- The README describes the two Tabs and their keys.
- The living spec (`../gh-prs/spec.md`) gets the To review search in Data, and the Tabs and keys in Popup.

## Testing Decisions

- A good test calls a public function with plain data and checks what comes out. It does not check how the function works inside.
- **The one seam is `parseRun`.** Tests give it a fake `gh` response with both search blocks. They check:
  - each list is filled from its own block;
  - an empty To review block gives an empty `prsToReview`;
  - a failed run gives an error and two empty lists;
  - each PR gets its `author`, and a missing author gives `ghost`.
- Prior art: the existing `parseRun success` tests. They use `node:test` and load the QML library with the existing loader. Existing tests stay unchanged, except for adding the new block to their fake response when the parser needs it.
- The QML has no automated tests. Check the Tabs, counts, keys, remembered Tab, `@author`, and empty and error states by hand after `omarchy restart shell`.

## Out of Scope

- A notification when a PR enters To review.
- Any change to the bar Badge or Bar summary for PRs to review.
- PRs the user already reviewed and that wait on the author (`reviewed-by:@me`).
- Saving the selected Tab across shell restarts.
- A setting to hide the To review Tab.

## Further Notes

- Each search still returns at most 50 PRs.
