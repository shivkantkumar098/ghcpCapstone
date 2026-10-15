---
name: GitHub MCP Guidance
description: Prefer GitHub MCP for GitHub repository, issue, and pull request operations.
applyTo:
  - ".github/agents/PRAgent.agent.md"
  - ".github/agents/SDLCOrchestrator.agent.md"
---

# GitHub Operations

- Use the available GitHub MCP tools first for GitHub API operations, including repository, issue, branch, and pull request actions.
- Use local Git commands for workspace status, diffs, and other local repository checks.
- Use an authenticated GitHub CLI only when MCP is unavailable or cannot perform the required operation.
- Never expose credentials, tokens, or secret values.
- Report an operation as successful only after its result is confirmed.
