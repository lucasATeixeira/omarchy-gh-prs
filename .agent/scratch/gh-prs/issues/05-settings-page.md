# 05 - Settings page

Status: resolved

Spec: `../spec.md`, section "Settings", subsection "Settings page".

## What

Add a gear button to the popup header that swaps the PR list for a settings page, and a way to save one setting to `shell.json` right away. Tickets 06, 07, and 08 fill the page.

## Acceptance criteria

- [x] A gear button (`nf-md-cog`) on the right of the popup header, next to the Bar summary, opens the settings page.
- [x] While the page is open: the header title is "Settings", the gear becomes a back arrow (`nf-md-arrow_left`), and the PR list is hidden.
- [x] The back arrow or Escape returns to the PR list. Closing the popup also returns to the list next time it opens.
- [x] The page shows three empty sections, in order: Refresh, AI checks, Notifications.
- [x] One function in `Panel.qml` saves a set of overrides: it builds the new entry from `root.settings` plus the overrides, keeps every other key, sets `root.settings`, and calls `bar.shell.updateEntryInline(moduleName, entry)`.
- [x] ~~A pure "settings with overrides" function in `js/prs.js`.~~ Dropped in review: it only wrapped `Object.assign`, so `saveSettings` calls that directly.

## Notes

- Pattern to follow: `persistWidgetSettings` in `../akitaonrails.ai-usagebar/omarchy/Panel.qml` and `settingsWithOverrides` in its `Model.js`. Copy only what this widget needs.
- Look in `~/.local/share/omarchy/shell/Ui/` for the shell's `Toggle`, `TextField`, and button components before writing new ones.
- The settings page can be its own `SettingsView.qml` next to `Panel.qml` if `Panel.qml` gets too long.

## Comments

Implemented on branch `settings-page`.
