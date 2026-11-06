# TorchMap 本地目录协议 v1

协议标识为 `tensormap/directory-1`。**一个日期目录下的一个 `NNN_自定义名称/` 就是画板上的一个模型版本。一张卡可以有零次、一次或多次训练。** 读取器通过项目目录发现版本，各训练框架可以独立写出这些文件。

```text
总目录/
  项目名称/
    project.json
    2026-11-01/
      001_baseline/
        version.json
        runs/
          01/
            run.json
            metrics.jsonl
            evals/
              val-40000/
                eval.json
                summary.json
            outputs/         可选的 PNG、音频、数组、索引
          02/                同版本换 seed 或独立重复训练
      002_自定义名称/
        version.json
```

项目、版本、run、评测和 checkpoint 的 ID 均为项目内稳定字符串；run 和评测共享运行 ID 命名空间。文件夹负责组织和展示，引用使用 ID。日期使用完整公历日期，编号为当日的三位数字。每张卡的 version.json 放在对应日期下。run 和评测的子目录名由写入方选择。文件编码为 UTF-8。

| 文件 | 必要字段与含义 |
|---|---|
| project.json | protocol、id、title。可选 description 和 layout，后者按版本 ID 保存画布 row。 |
| version.json | id、title、date、parents。独立起点使用空数组。parents 支持版本 ID，或含 id、kind、label 的对象；kind 取 branch、finetune 或 merge。可选 summary、changes、initialization、configuration。 |
| run.json | id、version_id、status、attempt、checkpoints。可选 config、step、total、last_seen、init_from、attempts。last_seen 是最近一次可信运行观测的 ISO 时间。init_from 指向实际加载的某份 checkpoint。checkpoints 中每项包含 id、step、weights、uri，URI 是本地相对路径或外部位置。 |
| metrics.jsonl | 每行是一项完整采样，含 attempt、step、metrics，可附 time。metrics 用具名的有限数值，同名指标统一单位。行尾换行表示该行发布完成。 |
| evals/*/eval.json | id、checkpoint_id、dataset、protocol、status、progress。progress 分开记录 done 和 total。独立评测归入产生被测权重的 run。|
| evals/*/summary.json | 完整评分后发布，metrics 为具名数值。可附 recordings_by_metric、units、timing 等统计口径。评测曲线的横坐标取 checkpoint.step。|

例如父版本 `a` 的训练发布 `a-40000-raw`。子版本 `b` 的 parents 包含 `a`，实际加载权重的 run 将 init_from 设为 `a-40000-raw`。若只继承代码并从头训练，init_from 为 null。相同步数的原始权重和 EMA 权重分别登记。多个数据集或评测协议各建一个 eval 目录，图表依据 dataset、protocol、weights、指标名分组。

### 中断与补评测

同一配方、同一试验恢复训练，沿用 run ID，attempt 从 1 开始递增。原生记录列出 attempts，例如 `[{"number":1},{"number":2,"resume_step":55000}]`。默认有效曲线保留前一次至 55000 步的历史，随后采用第二次的采样。metrics 文件保留历史原值。导入源只能提供已经拼好的有效曲线时，填写 `history_scope: "dashboard-effective-series"`，统一放入一个展示段，原始重启次数未知。

运行状态使用 queued、running、succeeded、failed、stopped，观测不足用 unknown；仅取得部分评测结果用 partial。独立评测写完 summary.json 再公布 succeeded。相同权重补测直接新增 eval 目录。可选 run.evaluations 用子目录名列出已发布的评测；省略时读取器扫描 evals/。尚未产生权重的计划可以单列 eval_plan，曲线只取已完成的评测。

### 文件职责与读取方式

配置、状态、摘要用 JSON；持续标量用 JSONL；大数组按需保存为 NPZ；可直接展示的图片和音频保留原格式。媒体可用 outputs/index.jsonl 记录 path、sample_id、step 或 checkpoint_id。手工 Markdown 与图片为可选文件。首版目录查看器提供卡片、运行、checkpoint 和标量查询；媒体渲染属于独立扩展。

每个活动文件指定一个写入者，分布式训练通常由 rank 0 写入。状态和最终汇总使用同目录临时文件后替换，权重与媒体先写完再发布引用。当前协议的写入假设适用于本地文件系统，共享对象存储可通过本地镜像接入。镜像只保存已允许的标量、元数据及汇总。断联保留上次成功观测。

在项目根运行 `node src/directory-server.mjs <总目录>`，默认本机端口 18772。浏览器按项目隔离的数据源读取真实目录，页面只读。进程中的索引最多缓存 30 秒，重读可恢复，无需先向 API 注册事件。原事件接口 `tensormap/0.1` 和目录协议使用各自的启动入口。

### 指标卡与数据切分

训练程序在 metrics.jsonl 的 metrics 对象中写入具名数值，每个键对应一张指标卡。例如一行可包含 `{"attempt":1,"step":800,"metrics":{"loss":0.42,"images_per_second":128.4}}`。独立验证和测试从评分完成的 summary.json 的 metrics 对象读取，按数据集、评测协议、权重类型和指标键分别画卡。图例按当前 Run 和地图选定的对照区分。相同指标键请保持同一单位。

自定义数据集可在 eval.json 指定 `"split":"validation"` 或 `"split":"test"`，也可在 project.json 指定 `"datasets":{"night-scenes":{"split":"test"}}`。单次评测声明优先。已有数据兼容 Val32、SF20 等命名，未指定且无法识别的归入验证。

### 每次训练的配置快照

训练进程在参数解析完成、开始训练前，由 rank 0 在自己的 run 目录写入 `config.json`。保存最终生效的嵌套参数对象，包括默认值、继承、环境及命令行覆盖的结果。建议覆盖模型、数据集与切分版本、预处理、采样、损失、优化器、学习率计划、训练精度、批量与梯度累积、随机种子及初始化来源；排除密钥。每次独立训练保存独立快照，续训若改变训练配方则新建 run 并登记 init_from。

可选 `config.yaml` 保留输入配方原文（含注释），在详情页浏览。字段比较读取 `config.json`，旧 run 回退到 run.json 中的 config，仅代表实际已登记的字段。未记录与显式 null 分开显示。

### 版本改动记录（每张模型卡一份）

- **主要改动**写入 `version.json` 的 `changes` 字符串数组。AI 或作者用一至三句或几点说明相对直接上游改了什么，一点一个字符串。只陈述能从配置、代码或实验记录核实的变化。没有上游时简述基线。已有版本缺少条目时展示 summary。
- **详细改动**写入与 `version.json` 同目录的可选 UTF-8 文件 `changes.md`。AI 或作者可补充动机、实现、参数表和已知限制，引用实测结果时注明对应 run。浏览器按 Markdown 渲染，支持标题、列表、表格和代码块，禁用原始 HTML。此文档属于版本，多个 run 共用；实际运行配置仍写入各自 run 的 config.json。

### 模型版本创建者

在每张模型卡的 `version.json` 中填写可选字符串 `creator`，如 `"creator": "小林 🐸"`。显示名支持 Unicode 和 emoji，由创建该版本的人或其工具填写。各卡独立保存；创建分支时不要继承父卡作者，缺失时留空。该字段用于署名，不用于身份认证或权限判断。
