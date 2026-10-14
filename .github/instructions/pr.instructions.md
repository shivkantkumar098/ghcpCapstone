---
name: PR Instructions
description: Defines storage, evidence, and authorization rules for Pull Request preparation.
applyTo: ".github/AgentOutput/**/*.md"
---

# Rules
- Save the preparation artifact to `.github/AgentOutput/<JIRA_ISSUE_KEY>/pr-summary.md`.
- Use the validated Jira issue key and matching artifact directory.
- Base descriptions on actual diffs and verified artifacts.
- Inspect source/target branches, Git status, staged/unstaged changes, and relevant untracked files. If the diff cannot be verified, mark PR readiness Blocked/Not Verified.
- Include all five required PR description sections.
- Include a changelog entry and reviewer checklist.
- Make generated-document checklist items conditional on an actual repository generator; use Not Applicable with a reason when none exists.
- Never fabricate test evidence, CI links, file changes, or PR URLs.
- Do not include secrets, API keys, tokens, or `.env` values.
- Require explicit user authorization before creating a PR.
- Obtain separate explicit authorization for commit, push, and PR creation; approval of a PR draft or an earlier stage is not authorization for these actions.
- Separate unresolved blockers from risks explicitly accepted/deferred by the user.
- Do not bypass failed required checks without an explicitly approved exception.
- Preserve unrelated files and existing artifacts.