# GymPlus

Initial professional-grade Next.js foundation with:

- Next.js App Router
- TypeScript in strict mode
- Scalable `src/` architecture
- Shared UI, features, providers, config, and utility layers
- ESLint and Prettier setup

## Scripts

```bash
npm install
npm run dev
```

## Project Structure

```text
src
├── app
├── components
├── config
├── features
├── lib
├── providers
└── styles
```

## Architecture Notes

- `app/`: routing, layouts, and page composition
- `features/`: domain-focused modules and page sections
- `components/`: shared UI building blocks
- `lib/`: framework-agnostic utilities
- `providers/`: app-level React providers
- `config/`: static config and metadata
