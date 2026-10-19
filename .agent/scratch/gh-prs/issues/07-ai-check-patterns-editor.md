# 07 - AI check patterns editor

Status: resolved

Blocked by: 05

Spec: `../spec.md`, section "Settings", subsection "AI checks".

## What

Let the user add and remove **AI check patterns** from the AI checks section of the settings page.

## Acceptance criteria

- [x] The section lists each pattern from `aiCheckNames`, one row each, with an ✕ that removes it.
- [x] A text field and an Add button add patterns; Enter in the field also adds. The field clears after adding.
- [x] Add splits the text on commas, trims each part, and skips blank parts and patterns already in the list, ignoring case.
- [x] The list is saved as one string joined with `, `.
- [x] An empty list is allowed and shows "No AI check patterns. The robot icon and AI review notifications are off."
- [x] After a change, `lastPrs` is set to null and the widget polls right away, so that poll sends no notifications.
- [x] Pure functions in `js/prs.js`, reusing `aiCheckPatterns` where it fits: parse the setting into a list, add text to a list, and join a list back into the setting. Tests cover: commas, spaces, blank parts, duplicates with different case, removing the last pattern, and an empty setting.
- [x] Label the section with the term "AI check patterns". README "Settings" table updated.

## Notes

- `aiCheckPatterns` lowercases the patterns for matching. The editor must show and save them as the user typed them.

## Comments

Implemented on branch `settings-page`.
