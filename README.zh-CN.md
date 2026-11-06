# TorchMap 🗺️

[English](README.md)

**TorchMap 是团队共用的模型版本路线图。** 每当有人尝试一个新想法，就从对应的上游模型拉出一张卡，写下谁改了什么。这个版本的配置、每次训练的曲线和权重，以及后来补跑的验证、测试，都挂在这张卡下面。下次组会有人问「这个结果是从哪版改出来的？」，点一下地图就能一起看。

![12 个模型版本的共享路线图，选中 M3 后高亮三条汇入它的实验分支](docs/assets/torchmap-lineage.png)

上图是[可复用的虚构项目](examples/branching.zh-CN.json)。三位同事可以从同一个 M1 出发，分别试 Mixup、标签平滑和更窄的网络。两条分支又从各自的权重做了微调，最后 M3 汇集三条路线的改动。点选 M3，就能顺着高亮路线找回这些决策；旁边试过的 Frozen-BN 分支也留在图上，下一位同事接手时看得见。实线表示设计迭代或合并，虚线表示从已有权重微调。

### 一张模型卡能回答什么？ 🔬

| 组会上常听到的问题 | 去哪里看 |
| --- | --- |
| 这版跟上版差在哪？ | 选中模型卡，看作者、主要改动和详细说明；按日期或迭代代数查看上下游。 |
| 换个 seed 又跑了一次，记在哪？ | 同一模型卡下新建一个训练 run，分别保留配置、训练步、曲线和 checkpoint。 |
| 这两个 loss 是同一轮实验吗？ | 双击卡片进入训练页，默认与直接上游对比，也能在地图上勾选其他版本。 |
| 昨天补测的 40K 权重，成绩记在哪？ | 验证和测试分别挂回产生权重的 run，曲线按 **40K** 对齐。数据集、评测口径和权重类型随结果保留。 |

![父版与续训分支的训练曲线，续训曲线从实际继承权重的步数开始](docs/assets/torchmap-curves.png)

### 让 Codex 帮你维护这张图 🛠️

**TorchMap 已提供可被 Codex 自动发现的 [Skill](.agents/skills/torchmap/SKILL.md)。** 在这个仓库里打开 Codex，告诉它要登记哪个项目、用的是哪份实验目录，剩下用自然语言交代即可。团队成员不用学字段名，也不用手填 JSON。例如：

> 用 TorchMap 登记这次实验。从 M1 分出「标签平滑」，从零训练，把这次 run 的配置和 loss 接进去。40K 权重的验证和测试已经跑完，请把已有结果挂回这个 checkpoint，核对网页上能看到两组指标。

第一次接团队项目，需要提供可访问的项目目录和真实实验输出。之后同事在自己的工作区装上[同一份 Skill](skills/torchmap/)，就能维护同一张图。

### 在本机逛一圈 🚀

准备 Node.js 22 或更高版本，运行：

```sh
git clone https://github.com/FunkyFrog1/TorchMap.git
cd TorchMap
npm start
```

打开[本地页面](http://127.0.0.1:18770)。另开一个终端，运行 `node examples/walkthrough.mjs`，点开它打印的链接。示例包含基线、从 40K 权重续训的分支，以及留出集评测。全程不用显卡，示例里的 loss 也是编的。

### 接入自己的实验 🔌

| 手头有什么 | 怎么接入 |
| --- | --- |
| 共享盘上的实验目录 | 运行 `node src/directory-server.mjs <项目总目录>`。日期目录下每个版本对应一张卡，卡片下面可以有多个 run。[目录协议](docs/protocol/directory-v1.zh-CN.md) |
| 可以上报事件的训练脚本 | 运行 `node src/cli.mjs help`，或参考 [HTTP 示例](examples/walkthrough.mjs)，记录指标、登记权重，并指定每次评测使用的检查点。[事件协议](docs/protocol/v0.1.zh-CN.md) |
| 帮忙接实验的 AI | 在本仓库打开 Codex 即可发现 [TorchMap skill](.agents/skills/torchmap/SKILL.md)，也可以把[便携版](skills/torchmap/)复制到自己的工作区。 |

任何训练框架都可以按协议写入数据。已有的 `tensormap/…` 协议标识、`TENSORMAP_*` 环境变量和数据目录沿用原名，已有实验可以继续读取。共享部署请通过本机回环地址或 SSH 隧道访问，服务没有内置登录鉴权。

**开发** · `npm ci` · `npm test` · `npx playwright install chromium` · `npm run test:ui`
[MIT 许可证](LICENSE)
