---
name: Code Review Instructions
description: Defines artifact storage and integrity rules for code review.
applyTo: ".github/AgentOutput/**/code-review.md"
---

# Rules
- Save review results to `.github/AgentOutput/<JIRA_ISSUE_KEY>/code-review.md`.
- Base findings on actual code, diffs, test results, or scan evidence.
- Inspect actual Git status/diff and relevant untracked files; if a baseline diff cannot establish scope, mark diff review Blocked/Not Verified.
- Review all seven required areas.
- Assess dependency safety only from available manifests/lockfiles and scanner results; use Not Verified when evidence is unavailable.
- Mark inapplicable checks Not Applicable with a short rationale.
- Do not modify production code during the review.