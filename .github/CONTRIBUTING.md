# Contributing / 参与贡献

Issues and pull requests in English or Chinese are welcome. Keep the tool focused on recording model-version lineage. Prefer simple, readable modules and native browser APIs; avoid adding a framework for a small feature.

欢迎使用中文或英文提交问题和 PR。项目专注于模型版本迭代记录，代码保持简单、可读，优先使用原生浏览器能力。

1. Fork the repository and create a branch for one focused change.
2. Run `npm ci`, `npm test` and `npm run test:ui` (install Chromium with `npx playwright install chromium`).
3. Add a regression test for a behavior change. Check both interface languages and a narrow viewport.
4. Run `npm run format` before submitting. Describe what changed, why and how you tested it.

Update Chinese and English interface text together in `src/web/i18n.js`. Do not translate user-entered project content. New examples, screenshots and test fixtures must be fictional and must not include personal paths, private project details or credentials.

界面文字需同步维护中英文，不翻译用户输入。示例、截图和测试数据应为虚构，不包含私人路径、项目内容或凭证。不要提交 `data/`、日志、浏览器测试输出或 `node_modules/`。

Be respectful and focus discussions on the work. Contributions are provided under the repository's MIT license.
