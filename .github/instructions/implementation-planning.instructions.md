---
name: Implementation Planning Instructions
description: Defines storage and integrity rules for implementation plans.
applyTo: ".github/AgentOutput/**/impl-plan.md"
---

# Rules
- Save the plan to `.github/AgentOutput/<JIRA_ISSUE_KEY>/impl-plan.md`.
- Base the plan on approved requirements, architecture, and design review.
- Order tasks according to dependencies, not just priority.
- Identify blocked tasks and their unblocking conditions.
- Do not turn an open risk or optional decision into a blocker unless it prevents safe implementation or required acceptance.
- Record task dependencies, requirement traceability, test/documentation tasks, and plan approval status. Plan creation is not plan approval.
- Do not implement code or commit/push changes.