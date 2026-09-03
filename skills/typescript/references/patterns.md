# TypeScript Patterns

Comprehensive TypeScript patterns used throughout the Atlas codebase.

## 1. Router Type Derivation

### Pattern: Deriving Types from tRPC Router Outputs

Extract types from tRPC router outputs for type-safe component props.

```typescript
import type { RouterOutputs } from "@/lib/api/client";

// List item type from paginated response
type TruckItem = RouterOutputs["trucks"]["list"]["items"][number];

// Single entity type
type DeliveryNote = RouterOutputs["deliveryNotes"]["get"];

// Nested property type
type DeliveryNoteStatus = RouterOutputs["deliveryNotes"]["get"]["status"];

// Stats object type
type UserStats = RouterOutputs["users"]["getUserStats"];
```

**When to use**: Always derive UI types from router outputs instead of importing DB types or duplicating schemas.

**Benefits**:

- Single source of truth
- Automatically updates when API changes
- Includes computed fields from queries
- Type-safe across boundaries

### Pattern: Router Input Types

```typescript
import type { RouterInputs } from "@/lib/api/client";

// Mutation input type
type CreateStackInput = RouterInputs["stacks"]["create"];

// Query input type
type ListStacksInput = RouterInputs["stacks"]["list"];
```

---

## 2. Zod Schema Patterns

### Pattern: Input/Output Schema Pairs

Every command exports paired input and output schemas with inferred types.

```typescript
import { z } from "zod";

// Input schema with strict validation
export const listMapInputSchema = z
  .object({
    warehouseId: z.string().uuid().optional(),
    status: z.array(z.enum(["open", "closed", "verified"])).optional(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(50),
  })
  .strict();

// Output schema matching response shape
export const listMapOutputSchema = z
  .object({
    items: z.array(
      z.object({
        stackId: z.string().uuid(),
        name: z.string(),
        status: z.enum(["open", "closed", "verified"]),
      }),
    ),
    page: z.number().int(),
    pageSize: z.number().int(),
    totalCount: z.number().int(),
    totalPages: z.number().int(),
  })
  .strict();

// Inferred types
export type ListMapInput = z.infer<typeof listMapInputSchema>;
export type ListMapOutput = z.infer<typeof listMapOutputSchema>;
```

**Critical**: Always use `.strict()` to reject unknown fields.

### Pattern: Enum Schemas

```typescript
// Define enum schema once
const stackStatusEnum = z.enum(["open", "closed", "verified", "certified"]);

// Reuse in schemas
const inputSchema = z.object({
  status: stackStatusEnum,
});

// Extract type
type StackStatus = z.infer<typeof stackStatusEnum>;
```

### Pattern: Drizzle Schema to Zod

```typescript
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { stacks } from "./schema";

// Auto-generate from Drizzle schema
export const selectStackSchema = createSelectSchema(stacks);
export const insertStackSchema = createInsertSchema(stacks);

// Customize with refinements
export const createStackSchema = insertStackSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1).max(100),
    lengthMm: z.number().int().positive(),
  });
```

---

## 3. Discriminated Unions (State Machines)

### Pattern: Status-Based Discriminated Unions

```typescript
// Delivery note with status-dependent fields
type DeliveryNoteBase = {
  id: string;
  name: string;
  createdAt: Date;
};

type DeliveryNoteDraft = DeliveryNoteBase & {
  status: "draft";
  stackId: null;
};

type DeliveryNoteAssigned = DeliveryNoteBase & {
  status: "assigned";
  stackId: string;
  assignedAt: Date;
};

type DeliveryNoteCompleted = DeliveryNoteBase & {
  status: "completed";
  stackId: string;
  assignedAt: Date;
  completedAt: Date;
  finalWeight: number;
};

type DeliveryNote =
  | DeliveryNoteDraft
  | DeliveryNoteAssigned
  | DeliveryNoteCompleted;

// Type-safe handling
function processDeliveryNote(note: DeliveryNote) {
  switch (note.status) {
    case "draft":
      // TypeScript knows stackId is null here
      console.log("Draft, no stack assigned");
      break;
    case "assigned":
      // TypeScript knows stackId is string here
      console.log(`Assigned to stack ${note.stackId}`);
      break;
    case "completed":
      // TypeScript knows all fields are present
      console.log(`Completed with weight ${note.finalWeight}`);
      break;
  }
}
```

### Pattern: Action-Based Discriminated Unions

```typescript
// Audit events with different payloads
type AuditEvent =
  | { action: "created"; userId: string; timestamp: Date }
  | {
      action: "updated";
      userId: string;
      timestamp: Date;
      changes: Record<string, unknown>;
    }
  | { action: "deleted"; userId: string; timestamp: Date; reason: string };

function recordEvent(event: AuditEvent) {
  switch (event.action) {
    case "created":
      // event.changes doesn't exist here
      break;
    case "updated":
      // event.changes is available here
      console.log(event.changes);
      break;
    case "deleted":
      // event.reason is available here
      console.log(event.reason);
      break;
  }
}
```

---

## 4. Utility Type Patterns

### Pattern: Extracting Nested Types

```typescript
// From router outputs
type StackList = RouterOutputs["stacks"]["list"];
type StackItem = StackList["items"][number];
type StackTotals = StackItem["totals"];

// From complex objects
type User = {
  profile: {
    name: string;
    settings: {
      theme: "light" | "dark";
      notifications: boolean;
    };
  };
};

type UserSettings = User["profile"]["settings"];
```

### Pattern: Pick and Omit

```typescript
// Select specific fields
type StackSummary = Pick<Stack, "id" | "name" | "status">;

// Exclude specific fields
type StackWithoutTimestamps = Omit<Stack, "createdAt" | "updatedAt">;

// Combine
type StackFormData = Omit<Stack, "id" | "createdAt" | "updatedAt"> & {
  tempId?: string;
};
```

### Pattern: Partial and Required

```typescript
// All fields optional (for updates)
type StackUpdate = Partial<Stack>;

// Specific fields required
type StackWithRequired = Required<Pick<Stack, "name" | "warehouseId">> &
  Partial<Stack>;

// Deep partial (use library like type-fest for nested)
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
```

### Pattern: Record for Maps

```typescript
// Map of IDs to entities
type StackMap = Record<string, Stack>;

// Map with specific keys
type StatusCounts = Record<"open" | "closed" | "verified", number>;

// Indexed access
const stacks: StackMap = {};
const stack = stacks["123"]; // Stack | undefined
```

---

## 5. Type Guards and Narrowing

### Pattern: Custom Type Guards

```typescript
function isDeliveryNoteAssigned(
  note: DeliveryNote,
): note is DeliveryNoteAssigned {
  return note.status === "assigned";
}

function isDeliveryNoteCompleted(
  note: DeliveryNote,
): note is DeliveryNoteCompleted {
  return note.status === "completed";
}

// Usage
if (isDeliveryNoteCompleted(note)) {
  console.log(note.finalWeight); // Type-safe access
}
```

### Pattern: Discriminated Union Guards

```typescript
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function handleResponse<T>(response: ApiResponse<T>) {
  if (response.success) {
    // TypeScript knows data exists
    return response.data;
  } else {
    // TypeScript knows error exists
    throw new Error(response.error);
  }
}
```

### Pattern: Array Type Guards

```typescript
function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

// Filter nulls with type safety
const stacks: (Stack | null)[] = [...];
const validStacks: Stack[] = stacks.filter(isNonNullable);
```

---

## 6. Generic Type Helpers

### Pattern: Paginated Response Type

```typescript
// Generic paginated response
type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

// Usage
type StacksResponse = PaginatedResponse<Stack>;
type TrucksResponse = PaginatedResponse<Truck>;
```

### Pattern: Async Function Return Types

```typescript
// Extract return type from async function
async function getStacks() {
  return { items: [], total: 0 };
}

type StacksResult = Awaited<ReturnType<typeof getStacks>>;
// { items: never[]; total: number }
```

### Pattern: Mutation Context Types

```typescript
// Base mutation context
export type BaseMutationContext = {
  db: Database;
  userId: string;
  now?: () => Date;
  requestId?: string | null;
  ipAddress?: string | null;
};

// Extended with observability
export type MutationContext = BaseMutationContext & {
  logger: Logger;
  eventPublisher: EventPublisher;
};

// Query context (read-only)
export type QueryContext = {
  db: Database;
};
```

---

## 7. Form Type Patterns

### Pattern: Form Data from Mutation Schema

```typescript
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

// Reuse command schema
const createStackSchema = z.object({
  name: z.string().min(1),
  warehouseId: z.string().uuid(),
  clientId: z.string().uuid(),
  lengthMm: z.number().int().positive(),
});

type CreateStackFormData = z.infer<typeof createStackSchema>;

// Type-safe form
const form = useForm<CreateStackFormData>({
  resolver: zodResolver(createStackSchema),
  defaultValues: {
    name: "",
    warehouseId: "",
    clientId: "",
    lengthMm: 0,
  },
});
```

### Pattern: Multi-Step Form Types

```typescript
// Step-specific schemas
const step1Schema = z.object({
  name: z.string().min(1),
  warehouseId: z.string().uuid(),
});

const step2Schema = z.object({
  clientId: z.string().uuid(),
  lengthMm: z.number().int().positive(),
});

// Combined schema
const fullFormSchema = step1Schema.merge(step2Schema);

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type FullFormData = z.infer<typeof fullFormSchema>;
```

---

## 8. Component Prop Patterns

### Pattern: Extending Base Props

```typescript
import type { ButtonProps } from '@/components/ui/button';

// Extend shadcn component props
type LoadingButtonProps = ButtonProps & {
  isLoading?: boolean;
  loadingText?: string;
};

export function LoadingButton({
  isLoading,
  loadingText,
  children,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={disabled || isLoading} {...props}>
      {isLoading ? loadingText : children}
    </Button>
  );
}
```

### Pattern: Polymorphic Component Props

```typescript
type StackCardProps = {
  stack: Stack;
  onClick?: (stack: Stack) => void;
} & React.HTMLAttributes<HTMLDivElement>;

export function StackCard({ stack, onClick, className, ...props }: StackCardProps) {
  return (
    <div className={cn('rounded border p-4', className)} {...props}>
      <h3>{stack.name}</h3>
      {onClick && <button onClick={() => onClick(stack)}>View</button>}
    </div>
  );
}
```

---

## 9. Async Type Patterns

### Pattern: Promise Return Types

```typescript
// Explicitly type async functions
async function fetchStack(id: string): Promise<Stack> {
  const data = await api.stacks.get({ id });
  return data;
}

// Extract promised type
type StackPromise = Promise<Stack>;
type UnwrappedStack = Awaited<StackPromise>; // Stack
```

### Pattern: React Query Types

```typescript
import type { UseQueryResult } from "@tanstack/react-query";

// Type query result
type StackQueryResult = UseQueryResult<Stack, Error>;

// Use in components
function StackDetail({ queryResult }: { queryResult: StackQueryResult }) {
  const { data, isLoading, error } = queryResult;
  // ...
}
```

---

## 10. Conditional Types

### Pattern: Status-Dependent Fields

```typescript
type WithStatus<T, S extends string> = T & { status: S };

type StackOpen = WithStatus<Stack, "open">;
type StackClosed = WithStatus<Stack, "closed">;

// Conditional type based on status
type StackFields<S extends StackStatus> = S extends "closed"
  ? { closedAt: Date; closedBy: string }
  : S extends "verified"
    ? { closedAt: Date; closedBy: string; verifiedAt: Date; verifiedBy: string }
    : {};
```

### Pattern: Optional Chaining Types

```typescript
type MaybeAsync<T> = T | Promise<T>;

async function unwrap<T>(value: MaybeAsync<T>): Promise<T> {
  return value instanceof Promise ? await value : value;
}
```

---

## Key Principles

1. **Derive, don't duplicate**: Use `RouterOutputs` instead of duplicating types
2. **Strict by default**: Always use `.strict()` on Zod schemas in routers
3. **Type guards for narrowing**: Use discriminated unions with type guards
4. **Compose utilities**: Build complex types from simple utility types
5. **Schema-first**: Define Zod schemas, infer types with `z.infer`
