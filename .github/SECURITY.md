# Security / 安全说明

Experiment Map is designed for one user on a trusted local computer. It listens on `127.0.0.1`, accepts browser saves only from the same origin, and serves an explicit asset list. Do not expose its port to the public internet; it has no authentication or multi-user access control.

本工具只用于可信本机的单人使用，不提供登录和多用户权限控制。请勿将端口直接暴露到公网。导入文件和导出内容均应由使用者核查。

To report a vulnerability, use the repository's **Security → Report a vulnerability** feature if available. If private reporting is unavailable, open an issue requesting a private contact channel without publishing exploit details or sensitive data. Ordinary bugs belong in Issues. Only the current release is maintained.

安全问题优先通过仓库的私密漏洞报告渠道提交；如未开放，请先提出联系请求，不要公开敏感内容。普通功能问题请提交 Issue，目前只维护当前版本。
