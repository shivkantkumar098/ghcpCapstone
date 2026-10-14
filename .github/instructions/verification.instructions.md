---
name: Verification Instructions
description: Defines storage and integrity rules for verification reports.
applyTo: ".github/AgentOutput/**/*.md"
---

# Rules
- Save results to `.github/AgentOutput/<JIRA_ISSUE_KEY>/verification-report.md`.
- Use the validated Jira issue key and matching artifact directory.
- Verify the actual implementation and generated documentation.
- Run documentation-generator checks only if this repository contains a corresponding generator and generated output; otherwise mark them Not Applicable with evidence.
- Record real commands, outcomes, and limitations.
- Classify each required check as Passed, Failed, Blocked, or Not Verified; an approved waiver never converts a non-passing result into Passed.
- Treat GitHub Actions/CI as separate from Copilot agent execution, and cite CI only when a real run/result is confirmed.
- Never fabricate test evidence or mark blocked checks as passed.
- Do not include secrets, tokens, API keys, or `.env` values.
- Preserve unrelated files and existing artifacts.
- Verify the report before claiming completion.
- Do not commit, push, or create a PR.