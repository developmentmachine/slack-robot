# Slack Workspace Automation & Hub

This repository serves as the central configuration and ruleset for Slack integrations, custom bots, and automated workflows.

## Features
- **Custom Cursor Rules**: Tailored for Slack Bolt framework, Web API, and Block Kit development.
- **Workflow Context**: Provides global instructions for AI-assisted development targeting Slack interfaces.

## CLI LLM Provider

The [`packages/cli-llm-provider`](packages/cli-llm-provider/) package wraps **Cursor CLI** and **Gemini CLI** as an injectable `LLMProvider` (`complete` + `stream`) for custom agents. See that package's README for usage.

## Environment Setup
Ensure the following credentials are securely managed (never committed):
- `SLACK_BOT_TOKEN` (xoxb-...)
- `SLACK_SIGNING_SECRET`
- `SLACK_APP_TOKEN` (xapp-..., if using Socket Mode)

## Tencent Docs MCP (Cloud Agents)

This repo includes [Tencent Docs MCP](https://docs.qq.com/openapi/mcp) via `.cursor/mcp.json`. Add `TENCENT_DOCS_TOKEN` in [Cloud Agents Secrets](https://cursor.com/dashboard/cloud-agents) — do not commit the token. See [docs/tencent-docs-mcp.md](docs/tencent-docs-mcp.md) for setup and troubleshooting.
