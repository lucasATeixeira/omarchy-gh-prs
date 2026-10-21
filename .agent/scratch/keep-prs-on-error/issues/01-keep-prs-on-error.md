# 01: Keep PRs on error

**What to build:** a failed poll changes only the error. The popup keeps the PRs, viewer login, and Last refresh from the last successful poll, and shows the error in red above the Sections. The Tab counts show whenever a successful poll happened. The Badge still shows a red `✕` on error. When the first poll fails, the popup shows only the error, as today. See `../spec.md` for the full rules.

**Blocked by:** none.

**Status:** ready-for-agent

- [x] `fetchProc.onExited` sets `prs`, `prsToReview`, `viewerLogin`, and `lastPollTime` only on success; on failure it sets only `error`.
- [x] The Tab counts, the Sections, and the empty text depend on `lastPollTime > 0`, not on `error === ""`.
- [x] The error text and the Sections show together when both exist.
- [x] The empty text shows under the error when the Last refresh had zero PRs on that Tab.
- [x] `tabs` tests updated if its signature or meaning changes, with no weaker assertions.
- [x] The main spec (`../../gh-prs/spec.md`) describes the new error behavior: the Tabs counts line and the "On error" line in Popup.
- [x] The README describes the new error behavior if it mentions it.
- [ ] Hand check: with old PRs, a failed poll keeps the list and shows the error above it; a first failed poll shows only the error; the next success clears the error.
