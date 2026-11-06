# TensorMap

Select a model, its run and optional comparison runs on the map. Direct parents are compared by default. Training, validation and test pages create one card per recorded scalar.

**Directory mode:** one dated version folder per map card, with independent training runs under `runs/`. Start the read-only viewer with `node src/directory-server.mjs <projects-root>`. [Directory protocol v1 (Chinese)](docs/protocol/directory-v1.zh-CN.md)

[简体中文](README.zh-CN.md) · [Protocol v0.1 draft (Chinese)](docs/protocol/v0.1.zh-CN.md)

A local model lineage map with live training runs and checkpoint-linked evaluations. Keep the date columns, draggable branches, bilingual UI and themes of Experiment-Map. Select a card to inspect runs or compare scalar curves with its parents. Research notes on a card are distinct from events reported by a process.

With Node.js 22 or later, run `npm start` and open http://127.0.0.1:18770 . No production dependencies or build required. In a second terminal run `node examples/walkthrough.mjs` to create a **new fictional project** and print a link to its training branch. Use **Compare** in the map toolbar. Train curves separate attempts; evaluation curves use the training step of the exact evaluated weights and separate datasets, evaluation protocols and weight variants.

Use `node src/cli.mjs help` for registering projects, versions, runs, metrics and checkpoints. Set `TENSORMAP_PROJECT` to the project ID and `TENSORMAP_URL` to the local service or tunnel. The [working example](examples/walkthrough.mjs) uses plain HTTP. Codex discovers the [TensorMap skill](.agents/skills/tensormap/SKILL.md) when you open this checkout. To use it in another workspace, install the portable skills/tensormap/ folder. It covers both directory projects and the event API. Put deployment-specific rules in TENSORMAP_TEAM.md at the workspace or deployment root. Attach existing Markdown notes or PNG/JPEG figures; there is no AI journal writer.

On first startup active Experiment-Map projects are **copied** into `data/tensormap/`. Existing maps are untouched. `TENSORMAP_HOME` overrides the workspace. To back everything up, stop writes and copy the workspace; map JSON export contains lineage only. One server writes each workspace. After a forced exit, check the PID in writer.lock before removing a stale lock. Use only loopback or an SSH tunnel; there is no multi-user authentication. External processes report their own state. The CLI can supervise a directly launched local child; remote scheduling, TensorBoard event import and automatic GPU sampling are outside this draft.

Development: `npm ci`, `npm test`, `npx playwright install chromium`, `npm run test:ui`. The [historical map guide](docs/map-guide.md) documents canvas interactions. MIT.
