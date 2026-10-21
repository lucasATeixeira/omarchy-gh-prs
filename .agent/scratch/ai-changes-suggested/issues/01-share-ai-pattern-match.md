# 01: Share the AI pattern match

**What to build:** one shared function that says if a name matches any AI check pattern, ignoring case. The AI Check filter uses it instead of its own inline match. Nothing changes for the user. Ticket 02 reuses it to find AI reviewers by login. See `../spec.md`.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] One function matches a name against the lowercase AI check patterns.
- [x] The AI Check filter uses it.
- [x] Every existing test passes with no test changed or removed.
