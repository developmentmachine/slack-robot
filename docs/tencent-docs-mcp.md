# 腾讯文档 MCP（Cloud Agents）

本仓库通过 [腾讯文档官方 MCP](https://docs.qq.com/openapi/mcp) 让 Cloud Agent 读写腾讯文档空间内的文件、表格、智能文档等。

## 前置条件

- 腾讯文档 **超级会员 / 超级会员 Plus**（部分能力需要 VIP，错误码 `400007`）
- 在空间内获取 MCP Token：[docs.qq.com/open/auth/mcp.html](https://docs.qq.com/open/auth/mcp.html)  
  或在空间菜单：**≡ → 使用 MCP → 获取 MCP token**（有效期约一年）

## 配置步骤

### 1. 仓库 MCP 配置（已提交）

`.cursor/mcp.json` 使用远程 HTTP 传输，**不会**把 Token 写进 Git：

```json
{
  "mcpServers": {
    "tencent-docs": {
      "url": "https://docs.qq.com/openapi/mcp",
      "headers": {
        "Authorization": "${env:TENCENT_DOCS_TOKEN}"
      }
    }
  }
}
```

> Header 的 key 必须是 `Authorization`，不能使用 `token`、`X-Token` 等别名。

### 2. 在 Cursor 中配置 Secret（必做）

Cloud Agent **无法**读取你本机的 `~/.cursor/mcp.json`，必须在 Cursor 控制台注入环境变量：

1. 打开 [Cloud Agents Secrets](https://cursor.com/dashboard/cloud-agents)（或 Settings → Cloud Agents → Secrets）
2. 新增 Secret：
   - **名称**：`TENCENT_DOCS_TOKEN`
   - **值**：你的 MCP Token（从腾讯文档复制）
3. 保存后 **重新启动** 正在运行的 Cloud Agent，新 Secret 才会生效

本地 Cursor Desktop 若也要用同一配置，可在 shell 中导出：

```bash
export TENCENT_DOCS_TOKEN="你的_token"
```

或在用户级 `~/.cursor/mcp.json` 中复用相同 `tencent-docs` 块（同样建议用 `${env:TENCENT_DOCS_TOKEN}`）。

### 3. 验证

在 Cloud Agent 对话中可让 Agent 调用腾讯文档工具，例如搜索空间文件、读取文档内容等。若鉴权失败，常见错误：

| 错误码 | 说明 | 处理 |
|--------|------|------|
| 400006 | Token 鉴权失败 | 检查 Secret 名称是否为 `TENCENT_DOCS_TOKEN`，值是否与空间 Token 一致 |
| 400007 | VIP 权限不足 | 升级 [腾讯文档 VIP](https://docs.qq.com/vip) |

## 安全说明

- **切勿**将 MCP Token 提交到 Git 或写在 PR/Issue/Slack 中
- Token 泄露后，请在腾讯文档空间内 **重置 MCP token**
- 本仓库 `.gitignore` 已忽略 `.env` / `.env.*`

## 参考

- [腾讯文档 MCP - 腾讯云开发者](https://cloud.tencent.com/developer/mcp/server/11803)
- [获取 MCP token 文档](https://docs.qq.com/open/document/mcp/get-token/)
- [Cursor MCP 文档](https://cursor.com/docs/mcp)
- [Cloud Agents MCP 支持](https://cursor.com/docs/cloud-agent)
