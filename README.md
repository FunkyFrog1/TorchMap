# TorchMap

[简体中文](README.zh-CN.md)

TorchMap gives a research team one shared map of its model versions. Each card records what changed and which version it came from. Open a card to inspect its training runs, configurations, checkpoints, and validation and test results.

<p align="center">
  <a href="docs/assets/torchmap-layouts.gif"><img src="docs/assets/torchmap-layouts.gif" alt="A team’s 24 model versions switching between date and generation layouts" width="620"></a>
</p>

These are the relationships from a working research project, with model names and change notes anonymized. 🐸 and 🐵 distinguish the two contributors. **By date** shows what the team worked on at the same time. **By generation** brings sibling experiments together, so you can trace a branch back to its baseline. The selected lineage stays highlighted as the cards move.

## Working with the map

Create a card when you change the model or training recipe. Link it to its parent and record whether training started from scratch or continued from a checkpoint. A repeat with a second random seed belongs under the same card as a separate run.

Double-click a card to open its training curves. Its direct parent is included in the comparison by default. Check other cards on the map to compare additional branches. In the example below, one run continues from a parent checkpoint and follows a different learning-rate schedule.

<p align="center">
  <a href="docs/assets/torchmap-curves.png"><img src="docs/assets/torchmap-curves.png" alt="Training workspace with pinned loss and learning rate, grouped metrics, and model change notes" width="760"></a>
</p>

Validation and test results attach to the checkpoint that produced them. If you evaluate a 40K checkpoint after training has finished, its score appears at step 40,000. Each result keeps its dataset, evaluation protocol and weight variant so teammates can interpret the comparison.

## Add an experiment with Codex

TorchMap includes a [Codex skill](.agents/skills/torchmap/SKILL.md) for registering versions and connecting existing results. Open this checkout in Codex, give it the shared project directory and the paths to your outputs, and describe the experiment in plain language. For example:

> Add a label-smoothing branch under M1. It trained from scratch. Attach this run’s configuration and loss, then link the validation and test reports to its 40K checkpoint.

Colleagues working in another repository can install the [portable skill](skills/torchmap/) and contribute to the same shared project.

## Run locally

Requires Node.js 22 or later.

```sh
git clone https://github.com/FunkyFrog1/TorchMap.git
cd TorchMap
npm start
```

Open the [local viewer](http://127.0.0.1:18770). To explore a sample project, run `node examples/walkthrough.mjs` in a second terminal and open the address it prints. The example includes a baseline, a continuation from 40K and checkpoint evaluations.

## Connect your own project

- **Existing experiment directories.** Run `node src/directory-server.mjs <projects-root>` to browse a shared project. Each dated version directory holds its runs. [Directory protocol (Chinese)](docs/protocol/directory-v1.zh-CN.md)
- **Training and evaluation scripts.** Run `node src/cli.mjs help` or adapt the [HTTP example](examples/walkthrough.mjs) to report metrics, register checkpoints and attach evaluations. [Event protocol (Chinese)](docs/protocol/v0.1.zh-CN.md)

The protocol is framework-independent. Existing projects use the original `tensormap/…` identifiers and `TENSORMAP_*` environment variables. For a shared deployment, access the service over loopback or an SSH tunnel. The service has no built-in authentication.

**Development** · `npm ci` · `npm test` · `npx playwright install chromium` · `npm run test:ui`

[MIT license](LICENSE)
