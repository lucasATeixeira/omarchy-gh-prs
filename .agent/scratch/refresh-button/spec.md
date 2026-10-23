# Spec: refresh button

## Problem

The popup polls when it opens and on a timer. While the popup stays open, for example right after a push,
the user has no way to poll now, and nothing shows when a poll runs.

## Decisions

1. A refresh button (`nf-md-refresh`) sits in the popup header, left of Settings, with the tooltip "Refresh". It is hidden when Settings is open.
2. A click, or the `r` key when Settings is not open, starts a poll now.
3. A poll runs while any of its three queries runs: the main fetch, the AI threads query, or the details query.
4. While a poll runs, the button is disabled and a press does nothing. No second poll is queued.
5. While a poll runs, the label under the title says "Refreshing…", even before the first Last refresh. After the poll, it shows the Last refresh again, also after a failed poll.
6. A manual poll is a normal poll: same notifications, same Last refresh. The automatic timer keeps its schedule.
7. No new glossary term: "refresh" already means a poll.

## Testing

- `Prs.refreshLabel` takes a `polling` argument and is unit tested.
- The button, the `r` key, and the disabled state get a hand check with `omarchy restart shell`.

## Out of scope

- Restarting the automatic timer after a manual poll.
- A spinning icon.
