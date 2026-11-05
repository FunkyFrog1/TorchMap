# TensorMap

在地图上点击模型卡，选择 Run，并用「对比」加选其他实验。默认叠加直接父版。训练、验证和测试页按记录的每个数值指标自动生成卡片。

**目录模式**按「项目 / 日期 / NNN_模型版本 / runs / 运行」读取实验。一张卡对应一个版本，同版本的多次训练分别保存。用 `node src/directory-server.mjs <项目总目录>` 启动只读监控。[正式目录协议 v1](docs/protocol/directory-v1.zh-CN.md)

[English](README.md) · [实验协议 v0.1 草案](docs/protocol/v0.1.zh-CN.md)

用一张地图追踪模型从哪一版演变而来，点开卡片查看相应训练、权重、评测和曲线。TensorMap 是 Experiment-Map 的后续版本：保留按日期排卡、拖拽建分支、多项目、中英文和主题。地图上的状态和手填指标是研究者的记录；运行面板反映程序实际报告的进度。

**快速体验**（Node.js 22+，运行时无第三方依赖）：

```sh
npm start
# 另开终端。下面命令创建一个独立的虚构项目，并打印可直接打开的链接：
node examples/walkthrough.mjs
```

服务默认 http://127.0.0.1:18770 。点开子版本，展开地图工具栏的“对比”，可叠加不同版本的训练 loss，也可按数据集和评测口径查看 checkpoint 的对应成绩。训练中断重试会保留各次尝试的曲线。卡片下支持查看手工上传的笔记与图片。

**接入自己的实验**：用网页建版本，用 `node src/cli.mjs projects` 查看项目 ID，通过 `TENSORMAP_PROJECT` 选择项目；CLI 默认连接本机服务，可用 `TENSORMAP_URL` 改地址。训练程序通过简单的 HTTP JSON 上报；不想改训练框架时，也可从现有日志转换后上报。不要向 SDK 上传波形、权重或逐事件明细。可运行的 [完整接入示例](examples/walkthrough.mjs) 演示分支续训、注册 EMA 权重、不同 checkpoint 验证和曲线。

```sh
node src/cli.mjs help
node src/cli.mjs snapshot
node src/cli.mjs event event.json
node src/cli.mjs attach my-version notes.md
```

[配套 skill](skills/tensormap/SKILL.md) 用同一协议登记与查询实验，无需它也能运行本工具。需要时将整个 `skills/tensormap/` 复制到所用 agent 的 skills 目录，并指出 TensorMap 的安装目录。附件是已有的人工作品，本版没有 AI 自动生成实验日志。

**数据与升级**：首次启动会把旧版活动地图复制到独立的 `data/tensormap/`，旧文件保留。可用 `TENSORMAP_HOME` 指定新的存储目录。完整备份请停止写入后复制整个工作区；画布导出的 JSON 只含地图。本地服务限单用户，请勿直接暴露到公网。强制终止后如出现 writer.lock，可核对其中 PID，确认旧服务已退出再移除锁文件。已有训练可仅上报，不受 TensorMap 控制；`exec` 仅托管直接启动的本地子进程。尚无远程调度、原生 TensorBoard 导入或 GPU 自动采集。

开发：`npm ci`、`npm test`、`npx playwright install chromium`、`npm run test:ui`。更多地图操作见[旧版地图指南](docs/map-guide.zh-CN.md)，存储和接口以新协议为准。MIT。
