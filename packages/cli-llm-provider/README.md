# @slack-hub/cli-llm-provider

通过 **官方 Cursor CLI / Gemini CLI 子进程** 提供统一的 `LLMProvider` 接口（`complete` + `stream`），便于注入自建 Agent，而无需 OpenAI 兼容网关或 sub2api。

## 形态说明（如何接入 Agent）

采用 **依赖注入**，与具体 Agent 框架解耦：

| 层级 | 类型 | 用途 |
|------|------|------|
| 核心 | `LLMProvider` | 任意 Agent 只依赖 `complete` / `stream` |
| 工厂 | `createCliProvider()` | 选择 `cursor` / `gemini` 后端 |
| 单轮 | `llmTurn(ctx, messages)` | Agent 循环里的一次模型调用 |
| 示例 | `runSimpleAgent()` | 最小多轮骨架（可再包工具循环） |

```ts
import {
  createCliProvider,
  llmTurn,
  type AgentLlmContext,
  type LLMMessage,
} from "@slack-hub/cli-llm-provider";

// 1. 创建 provider（登录：agent login / gemini auth）
const llm = createCliProvider({
  backend: "cursor", // 或 "gemini"
  cwd: process.cwd(),
  allowWrites: false, // 默认只读，避免 Agent 误改盘
});

const ctx: AgentLlmContext = {
  llm,
  systemPrompt: "You are a helpful assistant.",
};

// 2. 非流式
const result = await llmTurn(ctx, [
  { role: "user", content: "用一句话介绍这个项目" },
]);
console.log(result.text, result.sessionId);

// 3. 流式
await llmTurn(
  ctx,
  [{ role: "user", content: "写一首短诗" }],
  {
    stream: true,
    onChunk: (chunk) => {
      if (chunk.type === "text-delta") process.stdout.write(chunk.text);
    },
  },
);
```

### 在你自己的 Agent 里

```ts
async function agentLoop(ctx: AgentLlmContext, goal: string) {
  const history: LLMMessage[] = [{ role: "user", content: goal }];

  for (let i = 0; i < 5; i++) {
    const { text, sessionId } = await llmTurn(ctx, history, {
      sessionId: lastSessionId,
      stream: true,
      onChunk: (c) => { /* 推送到 Slack / UI */ },
    });
    lastSessionId = sessionId;
    history.push({ role: "assistant", content: text });
    // 若有工具调用，在此执行工具并把结果 append 到 history
    if (done) break;
  }
}
```

## 前置条件

- Node.js ≥ 20
- 已安装并登录：
  - **Cursor**: `curl https://cursor.com/install | bash` → `agent login`（或设置 `CURSOR_API_KEY`）
  - **Gemini**: [Gemini CLI](https://github.com/google-gemini/gemini-cli) → 按文档完成认证

## 配置

```ts
createCliProvider({
  backend: "cursor",
  binary: "agent",       // 或 cursor-agent 的绝对路径
  cwd: "/path/to/repo",
  timeoutMs: 600_000,
  trustWorkspace: true,  // Cursor: --trust
  allowWrites: false,    // Cursor: --force / Gemini: --yolo
  extraArgs: [],
});
```

## 流式事件

统一为 `LLMStreamChunk`：

- `text-delta` — 增量文本（适合 SSE / Slack 更新）
- `text` — 完整段落
- `tool-start` / `tool-end` — CLI 内置工具事件（可选监听）
- `done` — 含最终 `LLMCompleteResult`
- `error` — 错误信息

## 开发与测试

```bash
cd packages/cli-llm-provider
npm install
npm test
npm run build
```

单元测试通过 mock 子进程；真实 CLI 需在本地手动验证。

## 限制

- 每次调用启动一次 CLI 进程，延迟高于 HTTP API
- 并发建议 ≤ 2
- Cursor `-p` 偶发不退出的情况：已支持 `timeoutMs` 强杀
- 订阅额度是否计入 CLI 用量，以账号账单为准
