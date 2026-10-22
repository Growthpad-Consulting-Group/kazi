
<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Kazi — Codex Working Guidelines

## Project context
Kazi is a Next.js 16, React, TypeScript and Supabase application with staff management, authentication, permissions, integrations and other business workflows.

## Working approach
- Understand the requested change before editing.
- Inspect relevant files and their dependencies, not the entire repository by default.
- Reuse existing components, utilities, design tokens and patterns.
- Prefer focused, maintainable changes over unnecessary refactoring.
- Preserve existing functionality unless explicitly asked to change it.
- Do not install dependencies without a clear need.
- Ask for clarification when requirements are materially ambiguous.

## UI and design
- Follow existing visual conventions and component patterns.
- Maintain consistent spacing, typography, colours and responsive behaviour.
- Use existing shared UI components before creating new ones.
- Avoid unrelated visual changes.

## Backend and security
- Preserve authentication and role-based permissions.
- Validate inputs and handle errors appropriately.
- Never expose secrets or privileged credentials.
- Review database migrations for compatibility and data safety.
- Avoid destructive database operations without explicit approval.
- Follow existing integration and API patterns.

## Validation
- Run focused checks appropriate to the changed files.
- Use relevant lint and tests; run broader checks for cross-cutting changes.
- Fix errors introduced by the change.
- Report unrelated failures rather than silently modifying unrelated code.
- Do not claim tests passed unless they were executed.

## Communication
- Keep explanations concise.
- Summarize what changed, what was tested and any remaining issues.
- Avoid lengthy progress reports unless the task requires them.

## Efficiency and Safety

- Start by inspecting files directly relevant to the task.
- Expand investigation when changes affect shared components,
  dependencies, authentication, permissions, APIs, or database logic.
- Avoid unnecessary repository-wide searches and repeated file reads.
- Use focused lint and tests for small changes.
- Run broader validation for complex or cross-cutting changes.
- Prioritize correctness, security, and maintainability over
  minimizing token usage.