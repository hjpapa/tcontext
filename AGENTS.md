# TContext contributor guide

## Product invariants

- TContext is an anonymous teacher-context interview, not a personality test.
- Never score, rank, type, or diagnose a teacher or student.
- Describe classroom needs as supports the teacher can provide. Never identify a student.
- Keep teacher statements, AI inferences, and items needing confirmation visibly distinct.
- The teacher must be able to edit or delete every generated claim.
- Markdown download must work without a login or database write.
- Supabase contribution is optional, off by default, and separate from export.
- Never persist raw interview answers, IP addresses, user agents, names, emails, or cookies.

## Engineering rules

- Use Next.js App Router, strict TypeScript, Server Components by default, and client components only for interaction.
- OpenAI and Supabase secret operations belong only in Route Handlers or server-only modules.
- Validate every boundary with Zod and never log interview text or generated profiles.
- Keep `OPENAI_API_KEY` and `SUPABASE_SECRET_KEY` server-only; never add a `NEXT_PUBLIC_` alias.
- Use the structured profile JSON as the canonical source and derive Markdown from it.
- Add tests for privacy, consent, export, deletion, and retention changes.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before publishing.
