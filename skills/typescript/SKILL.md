---
name: typescript
description: TypeScript patterns for full-stack Next.js applications. This skill should be used when implementing type-safe API contracts, utility types, Zod schema integration, tRPC type inference, or type derivation patterns. Covers RouterOutputs/RouterInputs, branded types, discriminated unions, and server-first typing strategies.
---

# TypeScript Patterns

## Purpose

Provide opinionated TypeScript patterns for Next.js 16 + tRPC v11 applications emphasizing end-to-end type safety, type inference over manual typing, minimal type assertions, and strict compiler settings. Focus on deriving types from runtime sources (Zod, Drizzle, tRPC) for single source of truth.

## When To Use This Skill

**Type Derivation:**
- Derive UI types from tRPC RouterOutputs
- Extract mutation input types from RouterInputs
- Infer types from Zod schemas using z.infer<>
- Generate types from Drizzle schemas
- Create utility types for domain models

**Type Safety Patterns:**
- Implement branded types for IDs and primitives
- Create discriminated unions for state machines
- Build type-safe error handling patterns
- Enforce strict null checks and indexed access
- Prevent type assertions with proper narrowing

**API Boundaries:**
- Maintain type safety across server/client boundaries
- Prevent DB type leakage into UI components
- Ensure tRPC router outputs match Zod schemas
- Type-safe context and middleware

**Zod Integration:**
- Define schemas that serve as both runtime validators and type sources
- Extract TypeScript types from Zod schemas
- Compose complex schemas from primitives
- Implement schema transformations and refinements

**Advanced Patterns:**
- Create generic utility types
- Implement conditional types for type transformation
- Use mapped types for flexible interfaces
- Build recursive types for nested structures

**Troubleshooting:**
- Debug type inference failures
- Fix "Type instantiation is excessively deep" errors
- Resolve circular type dependencies
- Eliminate any types from codebase

## Core Principles

1. **Infer, Don't Declare**: Derive types from runtime sources (Zod, Drizzle, tRPC)
2. **Single Source of Truth**: Schema defines both runtime validation and types
3. **Strict Mode Always**: `strict: true`, `noUncheckedIndexedAccess: true`
4. **No Type Assertions**: Avoid `as` unless interfacing with untyped libraries
5. **Server Types Stay Server-Side**: Never import DB types in client components

## Quick Reference

### Type Derivation Hierarchy

```
Drizzle Schema → Zod Schema → tRPC Router → UI Types
```

**Example flow:**

1. Define DB table in Drizzle
2. Create Zod input/output schemas
3. Use in tRPC router with `.input()` / `.output()`
4. Derive UI types from `RouterOutputs`

### Common Patterns

| Pattern              | Usage                     | Reference                                     |
| -------------------- | ------------------------- | --------------------------------------------- |
| `RouterOutputs`      | Derive UI types from tRPC | `references/patterns.md#router-types`         |
| Branded Types        | Type-safe IDs             | `references/patterns.md#branded-types`        |
| Discriminated Unions | Type-safe state machines  | `references/patterns.md#discriminated-unions` |
| Zod Integration      | Schema → Type             | `references/patterns.md#zod-integration`      |
| Utility Types        | Domain helpers            | `references/patterns.md#utility-types`        |

## Type Safety Boundaries

### Server-Only Types

**Rule:** Never import DB schema types in UI components or RSC.

```typescript
// ❌ NEVER in UI
import type { Stack } from "@/lib/db/schema";

// ✅ Derive from tRPC instead
import type { RouterOutputs } from "@/lib/api/trpc";
type Stack = RouterOutputs["stacks"]["list"]["items"][number];
```

### Client-Server Type Flow

1. **Commands** (server): Use Drizzle/Zod types
2. **Routers** (boundary): Validate with `.input(Schema.strict())`
3. **UI** (client): Derive from `RouterOutputs`

## Working with tRPC Types

### RouterOutputs

Primary mechanism for UI types:

```typescript
import type { RouterOutputs } from "@/lib/api/trpc";

// List item type
type Vessel = RouterOutputs["vessels"]["list"]["items"][number];

// Single entity type
type VesselDetail = RouterOutputs["vessels"]["getById"];

// Nested types
type VesselPort = Vessel["ports"][number];
```

### RouterInputs

For forms and mutations:

```typescript
import type { RouterInputs } from "@/lib/api/trpc";

// Mutation input type
type CreateVesselInput = RouterInputs["vessels"]["create"];

// Query input type
type VesselFilters = RouterInputs["vessels"]["list"];
```

## Resources

### references/patterns.md

Detailed patterns including:

- Router type derivation strategies
- Branded type implementation
- Discriminated unions for state management
- Zod schema patterns
- Utility type recipes
- Type narrowing techniques

### references/recipes.md

Copy-paste solutions for:

- Deriving list item types
- Creating branded ID types
- Form types from mutation schemas
- Type-safe error handling
- Async function typing
- Generic type helpers

### references/examples.md

Real-world patterns from Atlas codebase:

- Stack management types
- Audit trail typing
- Multi-step form types
- Complex nested entity types
