---
name: Design Review Artifact Instructions
description: Defines storage and integrity rules for design review artifacts.
applyTo: ".github/AgentOutput/**/design-review.md"
---

# Rules
- Store review output at `.github/AgentOutput/<JIRA_ISSUE_KEY>/design-review.md`.
- Read `requirements.md` and `architecture.md` from that same issue directory.
- Update `architecture.md` only after agreement on material changes.
- Include finding severity, category, evidence, impact, recommendation, and status. Distinguish true blockers from risks that may be accepted/deferred, and state exact unblocking conditions.
- Mark checks Not Verified when evidence is absent; missing evidence is not a pass.