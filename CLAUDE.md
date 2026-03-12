# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Next.js)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

This is a **Next.js 16 app** using the App Router (`src/app/`), React 19, TypeScript, and Tailwind CSS v4.

- `src/app/layout.tsx` — Root layout with Geist fonts and global CSS
- `src/app/page.tsx` — Home page (currently the default scaffold, to be built into a todo app)
- `src/app/globals.css` — Global styles
- `next.config.ts` — Next.js config with React Compiler (`reactCompiler: true`) enabled

Styling uses Tailwind CSS v4 via PostCSS (`@tailwindcss/postcss`). No test framework is configured yet.

## Git Workflow

- Initialize a git repository if one doesn't exist (`git init`)
- Create a `.gitignore` appropriate for Next.js before the first commit
- Commit after every meaningful code change with a descriptive commit message
- Follow Conventional Commits format for all messages:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `chore:` for config/setup changes
  - `test:` for adding or updating tests
  - `style:` for UI/styling changes
  - `refactor:` for code restructuring

### Commit Message Examples

- `feat: add todo filtering by All / Active / Completed`
- `feat: persist todos to localStorage`
- `test: add vitest tests for todo CRUD operations`
- `chore: configure React Compiler in next.config.ts`
- `fix: prevent adding empty todo items`

### Rules

- Never batch everything into one giant commit
- Commit each logical unit of work separately
- Always stage all relevant files before committing (`git add -A`)
- Always push to the remote GitHub repo after every commit (`git push`)
