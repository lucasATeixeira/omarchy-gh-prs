# 02: Last refresh label

**What to build:** under the "Pull Requests" title, a small muted label says how long ago the Last refresh was: "Refreshed just now", "Refreshed N min ago", "Refreshed N h ago", or "Refreshed N d ago". It shows after the first successful poll, with or without an error, and is hidden while Settings is open. It updates every 30 s while the popup is open. See `../spec.md` for the full rules.

**Blocked by:** none. It touches the same file as 01, so do 01 first.

**Status:** resolved

- [x] A pure, documented function in `js/prs.js` turns the Last refresh and the current time into the label text, rounding down.
- [x] Tests for it in `tests/prs.test.js` cover 0 s, 59 s, 60 s, 59 min 59 s, 60 min, 23 h 59 min, 24 h, and a few days.
- [x] A `now` property is set every 30 s while the popup is open, when it opens, and on each successful poll.
- [x] The label shows under the title in muted caption text when `lastPollTime > 0` and Settings is closed.
- [x] The main spec (`../../gh-prs/spec.md`) describes the label in the Popup header.
- [x] The README describes the label if it lists the popup contents.
- [ ] Hand check: the label says "just now" after a poll, counts up while polls fail, and resets after a success.
