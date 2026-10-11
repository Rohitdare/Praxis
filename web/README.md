# Praxis Web Client (`web/`)

The frontend application for Praxis, built as a local-first Progressive Web Application (PWA).

## Tech Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript 6](https://www.typescriptlang.org/)
- **Bundler**: [Vite 8](https://vite.dev/) with `@tailwindcss/vite` and `vite-plugin-pwa`
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with semantic color tokens and dark/light modes
- **Local Storage**: [Dexie](https://dexie.com/) (IndexedDB wrapper) for offline capture and outbox queue
- **Remote DB & Auth**: [@supabase/supabase-js](https://supabase.com/docs/reference/javascript) with direct RLS
- **Icons**: [Lucide React](https://lucide.dev/)
- **Testing**: [Vitest](https://vitest.dev/) + React Testing Library + `fake-indexeddb`
- **Linter**: [Oxlint](https://oxc.rs/docs/guide/usage/linter)

## Development

```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev

# Run type check
npm run typecheck

# Run linter
npm run lint

# Run automated tests
npm test

# Build production bundle
npm run build
```

## Architecture Notes

- **Offline-First**: User capture writes immediately to local IndexedDB before queuing for outbox synchronization.
- **Route Code Splitting**: Routes (`/capture`, `/inbox`, `/notes`, `/calendar`, `/items/:id`, `/settings`, `/auth`) are loaded on-demand via `React.lazy()` to maintain a fast initial bundle load.
- **Type Safety**: Database tables and PostgreSQL RPC functions are strongly typed in `src/lib/supabase/database.types.ts`.
