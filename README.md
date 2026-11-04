# Experiment Map

[English](README.md) · [简体中文](README.zh-CN.md)

**A local notebook for model versions and their lineage.**

Record baselines, architecture changes, training recipes, fine-tuning origins and evaluation results in a date-column map. Trace a model back to its upstream versions without reconstructing its history from folders.

![Model lineage example](docs/assets/screenshot.png)

## Run locally

Install **Node.js 22 or newer**, then run from the project directory:

```sh
npm start
```

Open **http://127.0.0.1:18770/**. Windows users can also double-click `start.cmd`. Running the app needs no dependency installation or build step. Keep the terminal open; Ctrl+C stops it.

The first launch creates a local project from a fictional example. To keep your existing projects when updating the source, preserve the `data/` directory.

## Projects and model cards

Switch projects in the **left sidebar**. Its actions create, rename, import, export or archive a project. Project files, drafts and undo history are isolated. Switching waits for pending saves and locks editing; a failed save keeps you in the current project for retry with Ctrl+S.

Use **Add model version in the canvas toolbar** for an independent model or choose upstream models in its editor. Cards record:

- The model name, date, status and main change.
- Model/training configuration and initialization: scratch or a specific upstream checkpoint.
- Evaluation metrics, conclusions and next steps.
- Optional HTTP(S) links to code, checkpoints and reports. The app does not copy linked files.

Cards show the title, main change and status. The detail panel prioritizes changes, metrics and conclusions; configuration, initialization and upstream models expand on demand. Successful saves stay quiet; saving and failure states appear when needed.

## Drag to create a linked version

1. Hover a model card to reveal the circle on its right edge.
2. Drag the circle to a date column. A temporary wire and date label follow the pointer.
3. Hold near any canvas edge to pan automatically. The closer the edge, the faster the pan; it continues while the pointer is still. Move back to the center to stop.
4. Release inside the canvas to open the editor with the date and upstream model preselected. Fill in the model details and save to create the card and link.

Cancel the editor to leave the graph unchanged. Escape, pointer cancellation, releasing outside the canvas or losing window focus cancels the active drag. Project navigation and canvas rebuilds also clear its preview and auto-pan.

Date columns represent existing model dates, not a continuous calendar scale. Beyond the first or last column, each extra column preselects one additional calendar day. You can edit the date before saving. Keyboard users can focus a connector and press Enter or Space to open the linked-version editor without dragging.

![Creating a linked model](docs/assets/drag-create.png)

## Layout and relationships

Models on the same date share a column. Drag a **card vertically** to set its lane; dropping on an occupied lane swaps the two cards. Positions save and survive reopening. Change the date in the editor to move columns. Adding a model preserves existing saved lanes. Undo/redo covers edits, moves and new models within the current project session.

Select a card to highlight all upstream models; click blank space to restore all colors. Drag blank space to pan and scroll to zoom. The four-corner icon fits the full map; the crosshair focuses the selected card. Both have hover labels. The small line legend floats at the lower right.

The model lineage is a **directed acyclic graph (DAG)**. Multiple upstream models are allowed; cycles are rejected. The editor excludes self and descendants from upstream choices.

| Relationship | Meaning                                                                                          | Line   |
| ------------ | ------------------------------------------------------------------------------------------------ | ------ |
| Iteration    | Derive a version from upstream methods, code or settings; record whether weights are reused      | Solid  |
| Fine-tuning  | Continue from upstream weights; record the checkpoint in initialization                          | Dashed |
| Merge        | Combine methods/settings from multiple versions; specify actual weight initialization separately | Solid  |

Connections document provenance. The app does not train models, combine weights, run evaluations or verify metric claims. Use it alongside your training code and Git repository.

## Language and appearance

Click **中文 / EN** in the compact header to switch interface language. Click the **colored dot** to cycle themes; it flips to show the next color. Preferences persist in your browser across projects without translating your own notes or changing model data.

All themes retain the default page, panel and canvas backgrounds. Model-card bodies are white, with distinct colored headers and selected/upstream emphasis.

| Theme                                            | Accent palette                     |
| ------------------------------------------------ | ---------------------------------- |
| [Original console](docs/assets/theme-lagoon.png) | Sea blue, blue-gray and muted teal |
| [Dune](docs/assets/theme-dune.png)               | Sand, ochre and weathered blue     |
| [Coral](docs/assets/theme-coral.png)             | Dusty coral and pale blue-green    |
| [Oasis](docs/assets/theme-oasis.png)             | Sage and olive                     |
| [Dusk](docs/assets/theme-dusk.png)               | Muted lilac and slate blue         |

## Examples

Import the compact `examples/demo.en.json` or `demo.zh-CN.json`, or the full `examples/branching.en.json` / `branching.zh-CN.json`. The fictional Objects-12 story includes a CNN baseline, training changes, ablations, fine-tuning, a discarded BN-freezing experiment, combined settings and seed replication.

Dataset/model names, scores and latency are illustrative, not real research or hardware results. Planned models have no fabricated completed metrics. Examples and screenshots contain no working model records.

## Storage and sharing

| Path                             | Contents                                            |
| -------------------------------- | --------------------------------------------------- |
| `data/project.json`              | Default local model project                         |
| `data/projects/<id>.json`        | Other local model projects                          |
| `*.backup.json` beside a project | Previous successful save; replaced on the next save |
| `data/projects/archive/`         | Archived project files and backups                  |
| `.cache/`                        | Local logs and browser-test output                  |

Archive removes a non-default project from the picker and retains its files. Move its JSON back from `archive/` to `projects/` to restore it. The default project cannot be archived. Export JSON produces a portable snapshot. **Import replaces the selected project**; create a new project first to keep both. Export long-term backups: the previous-save backup is not a full version history. Multiple tabs do not automatically merge simultaneous edits.

The service binds only to `127.0.0.1`, for a single user on a trusted computer. It has no accounts, telemetry, external font downloads or runtime dependencies. Do not expose it as a public multi-user service. Working projects, backups, logs and dependencies are excluded from Git and release archives. Review your own notes/links before sharing.

Optional environment variables: `PORT` (default `18770`), and `EXPERIMENT_MAP_DATA_FILE` for a different default project file. Additional projects live beside that file in `projects/`.

## Development

```sh
npm ci
npm test
npx playwright install chromium
npm run test:ui
npm run format
```

Tests use temporary project files and separate ports, never your working data. They cover DAG rules, layout/routing, card and connector dragging, edge pan, cancellation, save/reload, undo/redo, slow/failed saves, project switching, archive recovery boundaries, themes, both languages and mobile layout. GitHub Actions runs core/HTTP and browser checks.

```text
src/core/       Model graph, date columns, saved lanes and wire routing
src/web/        Canvas, model editor, themes, translations and storage client
src/server.mjs  Local HTTP service and atomic JSON saves
tests/          Core, HTTP and browser regressions
examples/       Fictional model lineage examples
docs/           Screenshots, changelog and release guide
.github/        CI, contribution/security guides and issue/PR templates
```

Examples document the JSON format: `schemaVersion: 1`, unique node IDs and `YYYY-MM-DD` dates. Optional `row` stores the zero-based lane. Configuration, initialization, metrics and notes hold model records. Edge kinds are `branch`, `finetune` or `merge`; imports must be acyclic. Files are limited to 2 MB; links support HTTP(S).

[Contribute](.github/CONTRIBUTING.md) · [Security](.github/SECURITY.md) · [Changelog](docs/CHANGELOG.md) · [Publish on GitHub](docs/RELEASING.md)

## License

[MIT](LICENSE) © 2026 FunkyFrog1.
