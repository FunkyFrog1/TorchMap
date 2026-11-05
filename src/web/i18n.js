const english = {
  "按日期":"By date", "按代数":"By generation",
  拖出新版本: "Drag to create a linked model version",
  切换主题: "Next color theme",
  项目: "Project",
  外观: "Appearance",
  语言: "Language",
  重命名与说明: "Rename & description",
  缩略图: "Minimap",
  操作提示: "Canvas help",
  知道了: "Got it",
  画布操作提示:
    "Select a card to trace upstream; click blank space to reset. Drag blank space to pan, scroll to zoom, double-click a card to focus.",
  微调: "Fine-tuning",
  "版本迭代 / 合并": "Iteration / merge",
  归档项目: "Archive project",
  归档说明:
    "Archive this project? Its file stays in data/tensormap/archive and can be restored manually.",
  "上游关系形成了循环，请检查连线":
    "The upstream links form a cycle. Check the connections.",
  上游版本: "Upstream versions",
  不支持该请求: "Method not supported",
  中文: "中文",
  主要改动: "Changes",
  从第一个版本开始: "Start with your first version",
  "例如：v0.2 界面改进": "Example: M3 · distillation fine-tune",
  "例如：桌面布局；启用键盘导航":
    "Example: small CNN; 128×128 inputs; batch 64; fixed validation split",
  保存在本机: "Stored locally",
  保存失败: "Save failed",
  "保存暂未完成，请用 Ctrl+S 重试：": "Save is incomplete. Retry with Ctrl+S: ",
  "保存未完成 · Ctrl+S重试": "Not saved · Ctrl+S to retry",
  保存版本: "Save model version",
  保存项目: "Save project",
  "修改自动保存在本机，也可导出JSON分享。":
    "Changes save locally. Export JSON to share a project.",
  全图: "Fit all",
  全部路线: "All versions",
  关闭版本编辑: "Close version editor",
  关闭项目设置: "Close project settings",
  删除: "Delete",
  删除版本: "Delete version",
  删除说明:
    "Delete “{title}” and its links? Later versions are kept. You can undo this.",
  卡片摘要: "Summary",
  卡片颜色: "Card color",
  取消: "Cancel",
  只接受当前本地页面的保存请求: "Only same-origin local saves are accepted",
  可缩放拖动的实验关系画布: "Version map; drag to pan and scroll to zoom",
  可选多个: "Select multiple",
  合并改动: "Merge",
  "同一天的实验自动排列在同一列。": "Versions on the same date share a column.",
  同一对版本不能重复连线:
    "Duplicate links between the same versions are not allowed",
  "在同一张图中记录版本关系、改动与结论。":
    "Record model lineage, training changes and evaluation findings in one map.",
  备注: "Conclusions & next steps",
  定位选中: "Focus selection",
  "导入 JSON": "Import JSON",
  "导入失败：": "Import failed: ",
  导入完成: "Imported {n} versions. You can undo this.",
  "导出 JSON": "Export JSON",
  尚未填写摘要: "No summary yet",
  已保存到本机: "Saved locally",
  "已删除，可点击撤销恢复": "Deleted. Use Undo to restore.",
  已完成: "Complete",
  "已完成事项 = 8\n待处理事项 = 2":
    "Validation Top-1 = 84.6%\nParameters = 1.9 M",
  已导出JSON项目文件: "Project exported as JSON",
  已恢复尚未写入文件的本机草稿: "Recovered an unsaved local draft",
  "已新建项目，原项目可通过撤销恢复":
    "New project created. Undo to restore the previous project.",
  已暂停: "Paused",
  已记录: "Recorded",
  "已高亮当前版本及全部上游；点击空白恢复全图":
    "Selection and upstream highlighted. Click blank space to reset.",
  开始使用: "Get started",
  指标: "Evaluation metrics",
  "指标请按“名称 = 数值”填写，每行一条":
    "Enter one metric per line: name = value",
  搜索匹配: "Found {n} matching versions",
  "搜索版本 / 改动…": "Search versions / changes…",
  搜索版本与改动: "Search versions and changes",
  撤销: "Undo",
  "撤销 Ctrl+Z": "Undo Ctrl+Z",
  "改进键盘操作\n调整页面布局":
    "Add label smoothing\nKeep other training settings fixed",
  放大路线图: "Zoom in",
  数量上游: "{n} upstream",
  数量版本: "{n} versions",
  "新增或编辑卡片，设置日期与上游关系。":
    "Record the model, training settings, initialization and evaluation.",
  新增版本: "Add model version",
  新建项目: "New model project",
  "无法读取本地项目，请确认启动服务正常":
    "Cannot load the local project. Check that the server is running.",
  日期: "Date",
  "暂无可选上游；这个版本将作为独立起点。":
    "No upstream versions available. This version will be a starting point.",
  暂时无法打开项目: "Cannot open the project",
  未命名项目: "Untitled project",
  本地项目: "Local project",
  查看版本详情: "View version details",
  "正在保存…": "Saving…",
  "正在读取…": "Loading…",
  "每个版本都需要 ID 和名称": "Every version needs an ID and a title",
  每行一条: "One per line",
  "每行：名称 = 数值": "One per line: name = value",
  "每行：名称 | URL": "One per line: name | URL",
  灰紫: "Muted purple",
  灰蓝: "Muted blue",
  点击卡片查看版本详情: "Select a card to view its details",
  "点击卡片追溯上游 · 点击空白恢复全图 · 拖动平移 · 滚轮缩放":
    "Select to trace upstream · Click blank space to reset · Drag to pan · Scroll to zoom",
  "点击卡片追溯上游，点击空白恢复全图":
    "Select a card to trace upstream. Click blank space to reset.",
  点击填写版本改动: "Add changes to this version",
  "点击版本查看上游；点击画布空白恢复所有颜色。":
    "Select a version to trace upstream; click blank space to restore all colors.",
  "版本 ID 不能重复": "Version IDs must be unique",
  版本名称: "Model version title",
  "版本日期应为有效的 YYYY-MM-DD": "Use a valid date in YYYY-MM-DD format",
  版本详情: "Model version details",
  "版本说明 | https://example.com/report":
    "Release notes | https://example.com/report",
  版本路线图: "Version map",
  版本迭代: "Iteration",
  状态: "Status",
  独立起点: "Starting point",
  用一句话说明这次改变: "Describe the question this model version tests",
  的关系类型: ": relationship type",
  直接上游: "Upstream models",
  相关链接: "Links",
  石灰: "Stone gray",
  砂色: "Sand",
  确定: "Confirm",
  确认操作: "Confirm action",
  编辑版本: "Edit model version",
  编辑项目名称和说明: "Edit project title and description",
  缩小路线图: "Zoom out",
  藕灰: "Dusty rose",
  计划中: "Planned",
  记录指标: "Evaluation metrics",
  "记录改动，连接上游，逐步构建你的版本路线。":
    "Record changes and connect upstream versions to build your map.",
  "记录结论、待解决的问题或代码位置":
    "Record evaluation findings, tradeoffs and next experiments",
  "请使用本机 localhost 地址访问": "Use the local localhost address",
  "请选择 Experiment Map 的 JSON 项目文件（schemaVersion: 1）":
    "Choose an Experiment Map JSON project (schemaVersion: 1)",
  读取失败: "Load failed",
  路线图缩略图: "Map overview",
  进行中: "In progress",
  连线引用了不存在的版本: "A link references a missing version",
  配置说明: "Model & training configuration",
  重做: "Redo",
  "重做 Ctrl+Shift+Z": "Redo Ctrl+Shift+Z",
  "链接请按“名称 | http(s)网址”填写": "Enter links as: name | http(s) URL",
  雾蓝: "Slate blue",
  青灰: "Muted teal",
  页面不存在: "Page not found",
  "项目保存在本机 data/tensormap/。示例均为虚构，可自由编辑或新建项目。":
    "Each project is saved separately in the local data directory. Examples are fictional; edit them or start a new project.",
  项目名称: "Model project title",
  项目操作: "Project actions",
  "项目文件不能超过 2 MB": "Project files must be no larger than 2 MB",
  项目计数: "Versions {nodes} · Links {edges} · Dates {dates}",
  项目设置: "Project settings",
  项目说明: "Description",
  鼠尾草绿: "Sage green",
  "＋ 新增版本": "＋ Add model version",
  监控台原版: "Original console",
  沙海驿站: "Dune",
  珊瑚轨道: "Coral",
  绿洲档案: "Oasis",
  暮色电台: "Dusk",
  主题配色: "Color theme",
  模型版本迭代: "MODEL VERSION LINEAGE",
  初始化来源: "Initialization / training origin",
  "例如：从 M1 的最佳权重微调，或从头训练":
    "Example: fine-tune M1 best weights, or train from scratch",
};
const chinese = {
  画布操作提示:
    "点击卡片追溯上游，点击空白恢复颜色；拖动空白平移，滚轮缩放，双击卡片定位。",
  "项目保存在本机 data/tensormap/。示例均为虚构，可自由编辑或新建项目。":
    "各项目分别保存在本机 data 目录。示例均为虚构，可自由编辑或新建项目。",
  归档说明: "归档当前项目？文件会保留在 data/tensormap/archive，可手动恢复。",
  数量版本: "{n} 个版本",
  数量上游: "{n} 个上游",
  搜索匹配: "找到 {n} 个匹配版本",
  项目计数: "{nodes} 个版本 · {edges} 条关系 · {dates} 个日期",
  导入完成: "已导入 {n} 个版本，可撤销",
  删除说明: "删除“{title}”及其连线？后续版本会保留；删除后可撤销。",
  "同一天的实验自动排列在同一列。": "同一天的版本自动排列在同一列。",
  可缩放拖动的实验关系画布: "可缩放拖动的版本关系画布",
  新增版本: "新增模型版本",
  "＋ 新增版本": "＋ 新增模型版本",
  编辑版本: "编辑模型版本",
  保存版本: "保存模型版本",
  版本名称: "模型版本名称",
  配置说明: "模型与训练配置",
  指标: "评测指标",
  记录指标: "评测指标",
  直接上游: "上游模型",
  备注: "结论与后续计划",
  "例如：v0.2 界面改进": "例如：M3 · 蒸馏微调",
  "例如：桌面布局；启用键盘导航":
    "例如：小型卷积分类器；输入 128×128；batch 64；固定验证划分",
  "改进键盘操作\n调整页面布局": "加入标签平滑\n其他训练配置保持不变",
  "已完成事项 = 8\n待处理事项 = 2": "验证 Top-1 = 84.6%\n参数量 = 1.9 M",
  用一句话说明这次改变: "说明这一版模型主要验证什么",
  "记录结论、待解决的问题或代码位置": "记录评测结论、取舍和下一轮实验计划",
  "在同一张图中记录版本关系、改动与结论。":
    "在同一张图中记录模型继承关系、训练改动与评测结论。",
  "点击版本查看上游；点击画布空白恢复所有颜色。":
    "点击模型版本查看上游；点击画布空白恢复颜色。",
  "新增或编辑卡片，设置日期与上游关系。":
    "记录模型、训练配置、初始化来源和评测结果。",
  新建项目: "新建模型项目",
  项目名称: "模型项目名称",
  版本详情: "模型版本详情",
};
let locale = navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
try {
  const saved = localStorage.getItem("experiment-map:language");
  if (["zh-CN", "en"].includes(saved)) locale = saved;
} catch {}
export const language = () => locale;
export function t(key, variables = {}) {
  const text = (locale === "en" ? english[key] : chinese[key]) ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => variables[name] ?? match);
}
export function translatePage() {
  document.documentElement.lang = locale;
  for (const node of document.querySelectorAll("[data-i18n]"))
    node.textContent = t(node.dataset.i18n);
  for (const attribute of ["title", "placeholder", "aria-label"]) {
    for (const node of document.querySelectorAll(
      "[data-i18n-" + attribute + "]",
    ))
      node.setAttribute(
        attribute,
        t(node.getAttribute("data-i18n-" + attribute)),
      );
  }
}
export function setLanguage(value) {
  locale = value === "en" ? "en" : "zh-CN";
  try {
    localStorage.setItem("experiment-map:language", locale);
  } catch {}
  translatePage();
}
translatePage();
