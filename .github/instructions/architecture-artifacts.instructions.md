---
name: Architecture Artifact Instructions
description: Defines repository conventions and quality rules for architecture documents.
applyTo: ".github/AgentOutput/**/architecture.md"
---

# Architecture Artifact Rules

- Save architecture documents to `.github/AgentOutput/<JIRA_ISSUE_KEY>/architecture.md`.
- Base decisions on approved requirements and repository evidence.
- Use Mermaid diagrams and consistent Markdown headings where appropriate.
- Identify proposed components and distinguish them from existing implementation.
- Maintain traceability to requirement IDs.
- Document assumptions, risks, dependencies, and technology trade-offs.
- Keep verified facts, approved decisions, proposals, assumptions, unresolved questions, accepted risks, and blockers distinct.
- Map components and material decisions to requirement/acceptance IDs.
- Record approval status only when confirmed; artifact creation is not approval.
- Obtain approval before finalizing the architecture document.
