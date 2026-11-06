# TorchMap 项目目录协议 · 讨论稿

本稿保留设计讨论。实施约定以[正式目录协议 v1](directory-v1.zh-CN.md)为准。

目标是让训练程序只靠写文件就能接入。监控台给定总目录即可发现项目、读取曲线、关联权重和补评测。本文是下一版的设计提案，现有 v0.1 服务仍按原协议运行。

## 目录先按研究者的习惯组织

```text
TorchMap/
  image-generation/
    project.json
    2026-11-01/
      001_baseline/
        version.json
        runs/
          01/
            run.json
            metrics.jsonl
            outputs/                        可选
              index.jsonl
              sample-040000.png
            evals/                          开始有评测时才建立
              val-040000-01/
                eval.json
                summary.json
      002_larger-model/
        version.json
    2026-11-02/
      001_finetune/
        version.json
  eeg-decoding/
    project.json
```

最小项目只有 project.json，一张计划中的卡只需 version.json。第一次训练自动创建 runs/01；只训练一次的研究者不必手工命名 run。一天内的 001 是可读编号，同日可有多个子版本。目录使用完整日期，画布可简写为 1101。

## 文件与写入者

| 文件 | 最小职责 | 谁写 |
| --- | --- | --- |
| project.json | 协议版本、项目 ID、显示名称。可选说明、画布位置、手工笔记入口、常用指标及显示单位 | 项目编辑器或 CLI |
| version.json | 稳定的版本 ID、日期、标题、上游版本 ID。可选改动说明、代码引用 | 版本编辑器或 CLI |
| run.json | run ID、实际使用的配置快照、数据版本、初始化权重引用、执行状态、最近心跳、当前及历史 attempt、已发布 checkpoint 清单 | 本次训练的主进程或唯一适配器 |
| metrics.jsonl | 按训练步追加数值指标。一行可以含多项指标；训练和训练内验证可各用自己的采样间隔 | 同一 run 的指标写入者；多卡通常用 rank 0 |
| eval.json | eval ID、受测 checkpoint ID、数据集及切分版本、评测口径版本、状态、已完成与预计数量 | 该评测的协调进程 |
| summary.json | 已完成的聚合指标、各指标对应的样本范围、权重和耗时；逐记录分数可单独保存 | 评测协调进程 |
| outputs/ | 可选媒体或数组。index.jsonl 将文件关联到 step 或 checkpoint，并注明用途、样本 ID 和媒体类型 | 对应输出的生产者 |

模型目录可以改名。项目内的版本、run、checkpoint 和评测通过固定 ID 关联。继承关系只在子版本的 version.json 中声明，项目总文件可用 ID 记录卡片位置。运行中的输出目录应在写入方停写后移动。项目浏览器可缓存 ID 到目录的索引，该索引始终可以重建。

## 一条分支的实际记录

以下是两个不同版本的文件片段。版本 B 从版本 A 的 40K 原始权重继续训练。评测读取的是 B 在 45K 的平滑权重。文件名、目录名和显示标题均可与这些 ID 不同。

```json
{"id":"version-b","title":"分支 B","date":"2026-11-02","parents":["version-a"]}
```
```json
{"id":"run-b1","version_id":"version-b","init_from":"ck-a1-40000-raw","status":"running","attempt":1,"checkpoints":[{"id":"ck-b1-45000-ema","step":45000,"weights":"ema","uri":"weights/45000-ema.pt"}]}
```
```jsonl
{"attempt":1,"step":45000,"time":"2026-11-02T09:00:00Z","metrics":{"train/loss":0.62,"train/lr":0.00005}}
{"attempt":1,"step":45000,"time":"2026-11-02T09:02:00Z","metrics":{"val/loss":0.69}}
```
```json
{"id":"eval-b1-val-01","checkpoint_id":"ck-b1-45000-ema","dataset":"heldout-v1","protocol":"macro-v1","status":"complete","progress":{"done":32,"total":32}}
```

这些数字仅说明文件格式。checkpoint 的本地相对路径以其所属 run 目录为基准，也可记录外部 URI；监控台读取清单就能展示权重。父子版本关系与本次初始化分别记录，因此仅借鉴父版结构、实际从头训练也可准确表达。

## 曲线、输出与补评测

**实时标量用 JSONL。** 写入者按日志频率追加一行，监控台记住字节偏移，只读新增的完整行，最后一行未写完时留到下次。每次采样内可一起写 loss、学习率等数值。指标名应稳定，单位固定；缺失的值留空缺，不补零。可选 NPZ 用于保存成批数值数组，例如混淆矩阵、波形片段或特征。若以后需要封存很长的标量曲线，可按区间生成只读 NPZ 分片，并约定交接位置；首版先避免双份曲线和重复计数。

**生成结果按原生格式存。** 图片直接写 PNG/JPEG，音频可用 WAV，模型输出本来就是数值矩阵时用 NPZ。比如固定提示词和随机种子的图片可共用 sample_id，分别绑定不同 checkpoint，之后能在网页上对比同一样本的输出演变。项目和版本可以挂手工 Markdown；AI 自动写日志留作后续功能。

**评测按实际任务归档。** 训练内的 val/loss 可以直接写入该 run 的指标流。独立运行的验证或测试任务建在对应训练 run 的 evals/ 下。一份权重可补做多种评测，甚至数周后再做。训练曲线按原始 step 对齐；评测结果使用被评权重的 step，进度单独记录。同一步的 raw/EMA 使用不同 checkpoint ID。同名指标只在相同数据切分、权重类型、单位和统计口径下默认叠加。例如仅有部分记录提供完整 GT 时，需分别给出各指标的纳入数量。

**明确恢复语义。** 同配方同一次训练从自己的权重恢复，沿用 run ID，新增 attempt，并记录恢复的 checkpoint。若从 60K 回退到 55K，保留前一次尝试的明细；默认曲线在 55K 后采用新 attempt 的进度，不能拿旧 attempt 的 56K–60K 填满尚未重跑的部分。相同配方换 seed 开新的 run；改变配方做对照则建子版本。一次训练的多个 rank 共同属于同一个 run。

**写入与可见性。** 每个活动文件指定一个写入者。地图拖动只改项目信息，训练和评测各写自己的目录。权重或媒体先写完，再发布引用；评测汇总先写完，再发布完成状态。普通本地文件系统可用同目录临时文件后替换小型 JSON。共享对象存储需要按其发布语义使用不可变分片与完成清单，尤其不能假设挂载盘可靠支持原地追加和原子重命名。侧栏从项目根目录发现 project.json，只对活动 run 做增量读取。失去心跳记为失联，进程退出和评测完成由任务自身确认。

## 设计参考

TensorBoard 从指定日志目录发现不同 run 的事件文件，适合借鉴“给一个目录就能看曲线”的使用方式。[TensorBoard 官方仓库](https://github.com/tensorflow/tensorboard#runs-comparing-different-executions-of-your-model)

W&B 用 run ID 关联配置、指标历史、汇总和产物，适合借鉴“每个结果可追溯到具体一次运行”的语义。[W&B 官方 Run 实现](https://github.com/wandb/wandb/blob/main/wandb/sdk/wandb_run.py) · [W&B 官方查询接口](https://github.com/wandb/wandb/blob/main/wandb/apis/public/runs.py)

NumPy 的 savez 将多组具名数组保存进一个 ZIP 归档，适合组织完整的数组产物。[NumPy savez](https://numpy.org/doc/stable/reference/generated/numpy.savez.html)
