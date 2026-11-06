# *TorchMap🗺️*
[![Quick start](https://img.shields.io/badge/Quick_start-Run_locally-477389)](#quick-start) [![Codex Skill](https://img.shields.io/badge/Codex-Skill-54745d)](.agents/skills/torchmap/SKILL.md) [![Data protocol](https://img.shields.io/badge/Data-Protocol-806449)](docs/protocol/directory-v1.zh-CN.md) · [English](README.md)

---

## 📄 项目简介

TorchMap 用一张共享路线图（**MAP**）记录模型的迭代过程。每张卡片对应一个版本，记录它的上游模型和本次改动。训练记录、配置、权重及验证与测试结果都归入对应卡片，统一在 **MAP** 中管理。团队成员可以直接维护这张 **MAP**，也可以借助 Codex 按同一套协议登记实验，将结果追溯到具体的模型版本和训练步数。

---

## 🤗 用 **MAP** 管理实验

在 **MAP** 上选中一张模型卡片，就能看到这个版本的完整迭代路线。

<p align="center">
  <a href="docs/assets/torchmap-layouts.gif"><img src="docs/assets/torchmap-layouts.gif" alt="同一项目的 24 个模型版本在日期和代数布局间切换" width="600"></a>
</p>

双击卡片进入训练页，默认与直接上游比较。在 **MAP** 上勾选其他卡片，还可以把更多分支加入对照。

<p align="center">
  <a href="docs/assets/torchmap-curves.png"><img src="docs/assets/torchmap-curves.png" alt="训练页的置顶指标、分组曲线和模型改动说明" width="600"></a>
</p>

把关注的指标置顶，随时查看训练进展。

---

## 🧠 Codex Skill

项目内置了 [Codex Skill](.agents/skills/torchmap/SKILL.md)。在 Codex 中打开仓库，提供共享项目目录和实验产物路径，就可以直接用自然语言登记模型、关联训练和补充评测。例如：

> 在 M1 下新建一个标签平滑分支，这次从头训练。挂上这次运行的配置和 loss，再把验证、测试报告关联到 40K 权重。

在其他代码仓库工作的同事，也可以安装[独立版 Skill](skills/torchmap/)，共同维护同一张 **MAP**。

<a id="quick-start"></a>

## 🛠️ 快速开始

需要 Node.js 22 或更高版本。

```sh
git clone https://github.com/FunkyFrog1/TorchMap.git
cd TorchMap
npm start
```

## 版本发布

**2026-11-06 · 首版发布**

首版支持团队共同维护模型版本 **MAP**，按日期或迭代代数查看分支关系。每张模型卡片下可查看训练配置、比较指标曲线，并追溯验证和测试结果对应的权重。仓库内置 Codex Skill，方便团队成员把已有实验接入同一张 **MAP**。

欢迎感兴趣的开发者提交 Issue，或以其他形式参与项目。
联系邮箱：zgx13025221026@163.com

**开发检查** · `npm ci` · `npm test` · `npx playwright install chromium` · `npm run test:ui`

[MIT 许可证](LICENSE)
