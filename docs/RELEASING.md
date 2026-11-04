# Publishing on GitHub / 发布到 GitHub

The intended owner is **FunkyFrog1**. Repository links in `package.json` point to `FunkyFrog1/Experiment-Map`; creating or uploading this local project does not automatically publish it.

本项目的署名和预设仓库归属是 **FunkyFrog1**。本地文件和发布包准备好后，仍需由该账号创建仓库并上传。

1. Sign in to GitHub as FunkyFrog1 and create `Experiment-Map`.
2. Upload the contents of the release archive, preserving the directory structure and hidden files such as `.github/` and `.gitignore`. Alternatively, commit the local source with your own Git author settings and push to that repository.
3. Check that the **Tests** workflow passes. Enable private vulnerability reporting if desired; the fallback reporting route is described in [SECURITY.md](../.github/SECURITY.md).
4. Create a `v0.4.2` release using [CHANGELOG.md](CHANGELOG.md) and attach the source archive.

发布包仅含源码、文档、测试和虚构示例；不包含工作项目、备份、运行日志、依赖目录或本机配置。后续发布前运行核心及浏览器测试，并检查截图和示例不含私人内容。
