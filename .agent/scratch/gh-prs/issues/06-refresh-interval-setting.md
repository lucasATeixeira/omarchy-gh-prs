# 06 - Refresh interval setting

Status: resolved

Blocked by: 05

Spec: `../spec.md`, section "Settings", subsections "Refresh" and "Manifest".

## What

Let the user change `refreshIntervalSec` from the Refresh section of the settings page.

## Acceptance criteria

- [x] A number field with up and down arrows that step by 5 shows the current interval.
- [x] The value is a whole number from 5 to 3600. A typed value outside the range is clamped; a value that is not a number goes back to the saved value.
- [x] The field saves on Enter or when it loses focus; the arrows save on click.
- [x] The poll timer uses the new interval right away, and also reads its interval through the same clamp.
- [x] `manifest.json`: `refreshIntervalSec` becomes `"type": "integer"` with `"min": 5`, `"max": 3600`, `"step": 5`.
- [x] A pure clamp function in `js/prs.js`, tested for: inside the range, below 5, above 3600, a fraction, and a value that is not a number.
- [x] README "Settings" table updated.

## Comments

Implemented on branch `settings-page`.
