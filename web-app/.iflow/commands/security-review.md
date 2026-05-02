---
allowed-tools: Bash(git:*), Read, Grep
argument-hint: [文件路径] [优先级]
description: 审查代码安全漏洞
---

请审查当前代码中的安全漏洞。
重点检查：
1. SQL 注入风险
2. XSS 漏洞
3. 硬编码的密钥

文件：$1
优先级：$2

如果发现问题，请提供具体的修复建议。
