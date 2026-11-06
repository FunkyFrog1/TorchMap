# Changelog

## 0.5.0 · TorchMap protocol preview

Separate maps from append-only run events. Add attempts, checkpoint-linked evaluation, CLI, a local process wrapper, manual attachments and an optional agent skill. First start copies active legacy maps into a separate workspace.

## 0.4.2

- Cancel connector previews and edge-pan callbacks as project switching begins, including failed-save recovery.
- Add regressions for project switching during edge pan, window blur, canvas rebuild, zoomed/panned date targeting and outside-canvas drops.
- Rewrite both READMEs around the current sidebar, canvas creation flow, theme dot and storage behavior.
- Tighten header height to 40px while preserving logo and control sizes.

## 0.4.1

- Auto-pan in all four directions while a connector is held near a canvas edge.
- Update the target date and preview even while the pointer stays still.
- Stop panning on drop, cancel, Escape, window blur or canvas rebuild.
- Keep card bodies white and strengthen unselected card-header colors.

## 0.4.0

-

+- Drag a model's hover handle to create a linked version at a target date and lane.
+- Preview the connecting wire and date; save in the editor to commit, or cancel without changes.
+- Support new calendar dates outside existing columns and a keyboard creation action.
+- Move the add-version action into the canvas toolbar and shrink the header.
+- Outline the script E in the Em monogram for a consistent font-independent logo. +
+## 0.3.6

- Add an Em monogram with a large E and smaller overlapping lower-right m.
- Tint model-card bodies with the current theme while preserving default page surfaces.

## 0.3.5

- Widen the workspace and reduce side gutters.
- Replace the theme-name button with a flipping color dot.
- Keep default background surfaces across themes; preserve the other palette colors.

## 0.3.4

- Move project switching and management to a dedicated left sidebar.
- Reduce header height and branding size while retaining direct theme/language actions.
- Keep sidebar actions locked during pending project saves and switches.
- Adapt project controls to a compact horizontal strip on narrow screens.

## 0.3.3

- Remove the minimap and onboarding UI and their rendering paths.
- Put one-click language and theme cycling directly in the header.
- Lighten header controls with softer shapes and no offset shadows.
- Replace fit/focus text with inline SVG icons and translated accessible labels.
- Float the line legend in the bottom-right corner of the canvas.

## 0.3.2

- Consolidate project actions and appearance controls into compact menus.
- Remove repeated project names, card dates, summaries and parent counts.
- Show changes, metrics and conclusions first; collapse supporting model details.
- Add a persistent minimap toggle and dismissible first-use canvas help.
- Keep successful saves quiet and preserve save/error announcements.

## 0.3.1

- Use the original console's actual fonts, light palette and component styles as the default theme.
- Replace gradient buttons with the original solid face, inset highlight, 1px offset shadow and sea-blue hover state.
- Match the original blueprint grid, card headers, panel borders and detail typography.
- Preserve model records, card geometry, saved lanes, project switching and optional palettes.

## 0.3.0

- Focus the interface and documentation on model-version lineage.
- Add explicit initialization / training-origin records.
- Add five persistent paper-led retro-futurist themes.
- Add monitor-style shallow panel keys with hover, press and focus feedback.
- Replace generic cards with bilingual fictional model experiments, ablations and seed replication.
- Preserve DAG rules, saved card lanes and project isolation.

## 0.2.3

- Restore the original monitor-style cubic connections and smooth side loops.
- Limit straight connections to unobstructed horizontal links.
- Keep obstacle detours smooth, with horizontal tangents instead of elbow routes.

## 0.2.2

- Route clear cross-date links directly, including diagonal connections.
- Avoid actual card rectangles with curves or rounded gutter routes.
- Update wires and minimap connections while dragging cards.
- Use solid iteration/merge links and dashed fine-tuning links; remove reference links from the editor and legend.
- Place the initial canvas synchronously so the first interaction does not race a deferred fit.

## 0.2.1

- Wait for the last queued save and lock edits during project navigation.
- Keep save success independent of project-list network failures.
- Serialize archive operations and reject writes from stale archived-project tabs.
- Preserve the latest project list when responses arrive out of order.
- Rewrite both READMEs and add a detailed fictional branching demo.
- Add slow-network, failed-save, draft recovery and archive regression tests.

## 0.2.0

- Drag and save card lanes within date columns; swap occupied rows.
- Create, switch, rename and archive independent projects.
- Center the page with a maximum width and responsive side margins.

## 0.1.1

- Preserve saved card lanes across date changes and reloads.
- Place new continuations beside their upstream versions; separate same-day successors and branches without moving saved cards.
- Keep reference links from overriding the primary version lane.
- Add regression coverage for placement and date changes.

## 0.1.0

- Extract a standalone local version-history map with fictional examples.
- Add Chinese/English UI, date columns and curved relationship links.
- Support editing, automatic saves, JSON import/export and undo/redo.
- Trace all upstream versions; reset all colors with a blank canvas click.
- Add core, HTTP and browser tests and continuous integration.
