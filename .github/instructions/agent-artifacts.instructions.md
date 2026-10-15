---
name: Shared Agent Artifact Rules
description: Shared evidence, safety, and authorization rules for Jira SDLC artifacts.
applyTo: ".github/AgentOutput/**/*.md"
---

# Shared Artifact Rules

- Use the Jira key confirmed by Atlassian-MCP and save the artifact in its matching `.github/AgentOutput/<JIRA_ISSUE_KEY>/` directory.
- Base statements on reviewed source material and repository evidence. Mark unavailable facts as `Not Found`; do not invent details or results.
- Keep confirmed facts, decisions, assumptions, open questions, risks, blockers, and approval status distinct.
- Preserve existing artifacts and unrelated files.
- Do not include secrets, credentials, API keys, access tokens, passwords, or `.env` values.
- Verify saved artifacts before reporting completion.
- Do not commit, push, or create a pull request without explicit authorization for that action.