# *🗺️ TorchMap — A Shared **MAP** of Model Versions and Experiments*

[![Quick start](https://img.shields.io/badge/Quick_start-Run_locally-477389)](#quick-start) [![Codex Skill](https://img.shields.io/badge/Codex-Skill-54745d)](.agents/skills/torchmap/SKILL.md) [![Data protocol](https://img.shields.io/badge/Data-Protocol-806449)](docs/protocol/directory-v1.zh-CN.md) · [简体中文](README.zh-CN.md)

---

## Introduction

TorchMap organizes experiments around a shared **MAP** of model versions. Each card records the parent model and the change under study. Training runs, configurations, checkpoints, and evaluation results attach to that card, so a team can trace a reported score back to the model and weights that produced it.

<p align="center">
  <a href="docs/assets/torchmap-layouts.gif"><img src="docs/assets/torchmap-layouts.gif" alt="A 24-version project switching between date and generation layouts" width="620"></a>
</p>

**Figure 1.** The same 24 model versions arranged by date and by generation. The highlighted path traces one branch back to its baseline. Model names and change notes are anonymized. 🐸 and 🐵 identify the two contributors.

## Working with the **MAP**

Create a card when you change the model or training recipe. Link it to its parent and record whether training started from scratch or continued from a checkpoint. A repeat with a second random seed belongs under the same card as a separate run.

Double-click a card to open its training curves. Its direct parent is included in the comparison by default. Check other cards on the **MAP** to compare additional branches. In the example below, one run continues from a parent checkpoint and follows a different learning-rate schedule.

<p align="center">
  <a href="docs/assets/torchmap-curves.png"><img src="docs/assets/torchmap-curves.png" alt="Training view with pinned metrics, grouped curves, and model change notes" width="760"></a>
</p>

Validation and test results attach to the checkpoint that produced them. If you evaluate a 40K checkpoint after training has finished, its score appears at step 40,000. Each result keeps its dataset, evaluation protocol and weight variant so teammates can interpret the comparison.

## Add an experiment with Codex

TorchMap includes a [Codex skill](.agents/skills/torchmap/SKILL.md) for registering versions and connecting existing results. Open this checkout in Codex, give it the shared project directory and the paths to your outputs, and describe the experiment in plain language. For example:

> Add a label-smoothing branch under M1. It trained from scratch. Attach this run’s configuration and loss, then link the validation and test reports to its 40K checkpoint.

Colleagues working in another repository can install the [portable skill](skills/torchmap/) and contribute to the same shared project.

## Quick start

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

## Releases

**2026-11-06 · First release**

Teams can maintain a shared model version **MAP** and explore branches by date or generation. Each card brings together training configurations, metric comparisons, and validation and test results linked to their checkpoints. The included Codex Skill helps contributors add existing experiments to the same **MAP**.

Contributions and [issues](https://github.com/FunkyFrog1/TorchMap/issues) are welcome. Contact: [zgx13025221026@163.com](mailto:zgx13025221026@163.com).

[MIT license](LICENSE)
