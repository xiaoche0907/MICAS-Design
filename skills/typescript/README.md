# TypeScript Skill

Complete TypeScript patterns guide for Atlas project (Next.js 16, tRPC v11, Drizzle ORM).

## Contents

- **SKILL.md** - Main skill documentation
  - Purpose, when to use, core principles
  - Type derivation hierarchy (Drizzle → Zod → tRPC → UI)
  - Quick reference table of common patterns
  - Type safety boundaries (server vs client)
  - RouterOutputs/RouterInputs usage
  - Core principles and best practices

- **references/patterns.md** - Detailed type patterns
  - Router type derivation strategies
  - Branded type implementation
  - Discriminated unions for state management
  - Zod schema integration patterns
  - Utility type recipes
  - Type narrowing techniques
  - Advanced generic patterns
  - Conditional and mapped types

- **references/recipes.md** - Copy-paste solutions
  - Deriving list item types from RouterOutputs
  - Creating branded ID types
  - Form types from mutation schemas
  - Type-safe error handling
  - Async function typing
  - Generic type helpers
  - Fixing common type errors

- **references/examples.md** - Real-world examples
  - Stack management types (from Atlas codebase)
  - Audit trail typing patterns
  - Multi-step form type composition
  - Complex nested entity types
  - RBAC context typing
  - Command-query type patterns

## Usage

When working with TypeScript in Atlas:

1. Start with **SKILL.md** for core principles and quick reference
2. Check **patterns.md** for detailed implementation guidance
3. Use **recipes.md** for copy-paste solutions to common problems
4. Refer to **examples.md** for real-world Atlas patterns

## Key Principles

1. **Infer, Don't Declare** - Derive types from runtime sources (Zod, Drizzle, tRPC)
2. **Single Source of Truth** - Schema defines both runtime validation and types
3. **Strict Mode Always** - Enable `strict: true` and `noUncheckedIndexedAccess: true`
4. **No Type Assertions** - Avoid `as` unless interfacing with untyped libraries
5. **Server Types Stay Server-Side** - Never import DB types in client components

## Quick Links

- TypeScript handbook: https://www.typescriptlang.org/docs/handbook/
- Zod docs: https://zod.dev
- tRPC type inference: https://trpc.io/docs/server/infer-types
- Atlas framework: `@/framework/patterns/typescript.md`
