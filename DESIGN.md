# ASP Study Hub Design Contract

## Product Intent

ASP Study Hub is a project memory and collaboration workspace. It should help a team plan work, run study/project cycles, preserve decisions, and archive outcomes without turning the homepage or workspace into a marketing page.

## Workspace Principles

- Each workspace tab has one primary job.
- Overview shows project health, roadmap flow, and decision history.
- Planning Board manages actionable work items.
- Editor creates draft records before review.
- Review validates records before they become durable team knowledge.
- Archive stores final artifacts and evidence.

## Template Content Policy

Seed content is treated as a project template, not as immutable product data.

- Viewers can read template content.
- Developers can create editable project content.
- Admins can convert template content into editable project content.
- Excluding template content is a secondary cleanup action, not the main editing path.
- UI copy should use "Template" or "기본 템플릿", not "Seed".

## Interaction Standards

- Primary actions create or save project-owned data.
- Destructive actions are visually secondary unless they are the task's main purpose.
- Dense records should use short summaries in lists and detailed editing in modals.
- Roadmaps should read as a time flow.
- Decisions should read as an audit-friendly log with status, date, title, decision, and impact.

## Visual Direction

- Use restrained operational UI, not decorative dashboards.
- Prefer clean structure, clear spacing, and low-contrast panels.
- Avoid large blocks of explanatory text inside work surfaces.
- Use labels and state chips for scanning.
- Keep cards flat, compact, and purposeful.
