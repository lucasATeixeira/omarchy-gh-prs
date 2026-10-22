# Spec: age PRs to review from their latest Review request

## Problem

The To review Tab hides a Stale PR by its `updatedAt`. Bots and merges from `main` change `updatedAt`,
so a PR that nobody has asked the user to review for weeks still shows. Example: flutter_packages#944,
requested from team `frontend` on 2026-09-24, kept fresh by a coverage bot comment on 2026-10-20.

## Decisions

1. In the To review Tab, a PR's age counts from its latest Review request: a request to the user or to a team the user is in.
2. Requests to other people or teams do not count.
3. When no Review request event is found, the age counts from the PR's creation.
4. The Authored Tab keeps counting from `updatedAt`.
5. Stale PRs stay hidden in the popup and the Badge and still notify.
6. The `toReviewMaxAgeDays` setting keeps its key and value. Its label becomes "To review: max days since review was requested".
7. The user's teams come from GitHub in the main query.

## Out of scope

- Changing which PRs send notifications.
- Changing the Authored Tab.
