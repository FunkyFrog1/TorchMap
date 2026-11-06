# TorchMap 🗺️

[简体中文](README.zh-CN.md)

Which model gave you that curve? And which checkpoint did you actually evaluate? TorchMap puts **model versions on a map**, with training runs and checkpoint evaluations attached to each version. Give `final_final_v3` a well-earned retirement.

![TorchMap model lineage with a baseline and a checkpoint continuation](docs/assets/torchmap-lineage.png)

### Follow a branch 🧬

Click a model to highlight its ancestors. Double-click to open its training curves. TorchMap compares the direct parent by default; tick other cards on the map to build your own comparison. Click the floating minimap to get back.

### Read the curves 📈

Training, validation and test metrics have their own views. Expand a group and pin the metrics you care about. Pins follow you across models in the same project. Evaluation points sit at the training step of the checkpoint that produced them, so “evaluation batch 32” never gets mistaken for “training step 32.”

![Training loss for the fictional baseline and continuation on the same axes](docs/assets/torchmap-curves.png)

### Try it locally 🚀

With Node.js 22 or later:

```sh
git clone https://github.com/FunkyFrog1/TorchMap.git
cd TorchMap
npm start
```

Open [the local viewer](http://127.0.0.1:18770). In a second terminal, run `node examples/walkthrough.mjs` and open the link it prints. The fictional example includes a baseline, a branch resumed from its 40K checkpoint and held-out evaluations. No GPU required. The losses are fictional too.

### Bring your own experiment 🔌

| What you have | Where to start |
| --- | --- |
| A shared directory of experiments | Run `node src/directory-server.mjs <projects-root>`. Each dated version folder becomes a card, with its own runs underneath. [Directory format (Chinese)](docs/protocol/directory-v1.zh-CN.md) |
| A script that can emit events | Run `node src/cli.mjs help` or adapt the [HTTP walkthrough](examples/walkthrough.mjs). Report metrics, register checkpoints and link evaluations to the weights you used. [Event format (Chinese)](docs/protocol/v0.1.zh-CN.md) |
| A coding agent | Open this checkout for the [discoverable skill](.agents/skills/torchmap/SKILL.md), or copy the [portable skill](skills/torchmap/) into your workspace. |

TorchMap works with any framework that writes the protocol. Existing `tensormap/…` protocol identifiers, `TENSORMAP_*` environment variables and data directories keep their original names so existing runs stay readable. Use loopback or an SSH tunnel for a shared server; the service has no built-in authentication.

**Development** · `npm ci` · `npm test` · `npx playwright install chromium` · `npm run test:ui`
[MIT license](LICENSE)
