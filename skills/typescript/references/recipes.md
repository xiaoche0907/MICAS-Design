# TypeScript Recipes

Copy-paste solutions for common TypeScript tasks in Atlas.

## Recipe 1: Derive List Item Type from Router Output

**Problem**: Need type for individual items from a paginated list query.

```typescript
import type { RouterOutputs } from '@/lib/api/client';

// Extract list item type
type TruckItem = RouterOutputs['trucks']['list']['items'][number];
type SupplierItem = RouterOutputs['suppliers']['list']['items'][number];
type StackItem = RouterOutputs['stacks']['listMap']['items'][number];

// Use in component props
type TruckTableProps = {
  trucks: TruckItem[];
};

export function TruckTable({ trucks }: TruckTableProps) {
  // Fully typed
  return (
    <table>
      {trucks.map(truck => (
        <tr key={truck.id}>
          <td>{truck.licensePlate}</td>
        </tr>
      ))}
    </table>
  );
}
```

**When**: Whenever you need to type list items in UI components.

---

## Recipe 2: Derive Single Entity Type from Router Output

**Problem**: Need type for entity returned by `get` or mutation.

```typescript
import type { RouterOutputs } from '@/lib/api/client';

// Single entity from query
type DeliveryNote = RouterOutputs['deliveryNotes']['get'];
type Stack = RouterOutputs['stacks']['get'];

// Entity from mutation
type CreatedStack = RouterOutputs['stacks']['create'];
type UpdatedDeliveryNote = RouterOutputs['deliveryNotes']['updateWeights'];

// Use in component
type StackDetailProps = {
  stack: Stack;
};

export function StackDetail({ stack }: StackDetailProps) {
  return <div>{stack.name}</div>;
}
```

---

## Recipe 3: Derive Nested Property Types

**Problem**: Need type for nested property from router output.

```typescript
import type { RouterOutputs } from "@/lib/api/client";

// Nested property type
type DeliveryNoteStatus = RouterOutputs["deliveryNotes"]["get"]["status"];
type StackTotals =
  RouterOutputs["stacks"]["listMap"]["items"][number]["totals"];

// Use for type-safe comparisons
function isDeliveryNoteDraft(status: DeliveryNoteStatus): boolean {
  return status === "draft";
}

// Use for nested object props
type TotalsDisplayProps = {
  totals: StackTotals;
};
```

---

## Recipe 4: Form Types from Mutation Schemas

**Problem**: Need type-safe form data matching mutation input.

```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// Define schema (typically imported from command)
const createStackSchema = z.object({
  name: z.string().min(1, 'Name required'),
  warehouseId: z.string().uuid('Invalid warehouse'),
  clientId: z.string().uuid('Invalid client'),
  lengthMm: z.number().int().positive('Length must be positive'),
});

// Infer form data type
type CreateStackFormData = z.infer<typeof createStackSchema>;

// Create type-safe form
export function CreateStackForm() {
  const form = useForm<CreateStackFormData>({
    resolver: zodResolver(createStackSchema),
    defaultValues: {
      name: '',
      warehouseId: '',
      clientId: '',
      lengthMm: 0,
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    // data is fully typed as CreateStackFormData
    console.log(data.name, data.warehouseId);
  });

  return <form onSubmit={onSubmit}>{/* form fields */}</form>;
}
```

---

## Recipe 5: Type-Safe Error Handling

**Problem**: Need to handle different error types with type safety.

```typescript
import { TRPCClientError } from '@trpc/client';
import type { AppRouter } from '@/lib/api/routers';

// Type guard for TRPC errors
function isTRPCError(error: unknown): error is TRPCClientError<AppRouter> {
  return error instanceof TRPCClientError;
}

// Handle errors with type safety
async function handleMutation() {
  try {
    await api.stacks.create.mutate({ ... });
  } catch (error) {
    if (isTRPCError(error)) {
      // Typed TRPC error
      if (error.data?.code === 'CONFLICT') {
        toast.error('Stack already exists');
      } else if (error.data?.code === 'FORBIDDEN') {
        toast.error('Permission denied');
      } else {
        toast.error(error.message);
      }
    } else {
      // Unknown error
      toast.error('Unexpected error occurred');
    }
  }
}
```

---

## Recipe 6: Async Function Typing

**Problem**: Need proper types for async functions in queries/mutations.

```typescript
import type { Database } from "@/lib/db/client";
import type { Stack } from "@/lib/db/schema";

// Query function with explicit return type
export async function getStack(
  ctx: { db: Database },
  input: { id: string },
): Promise<Stack> {
  const [stack] = await ctx.db
    .select()
    .from(stacks)
    .where(eq(stacks.id, input.id));

  if (!stack) {
    throw new NotFoundError("Stack", input.id);
  }

  return stack;
}

// Mutation function returning created entity
export async function createStack(
  ctx: { db: Database; userId: string },
  input: { name: string; warehouseId: string },
): Promise<Stack> {
  const [stack] = await ctx.db
    .insert(stacks)
    .values({
      ...input,
      createdBy: ctx.userId,
    })
    .returning();

  return stack;
}
```

---

## Recipe 7: Generic Paginated Response Helper

**Problem**: Need reusable type for all paginated endpoints.

```typescript
// Define once
export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

// Use in queries
export async function listStacks(
  ctx: QueryContext,
  input: ListInput,
): Promise<PaginatedResponse<Stack>> {
  const items = await ctx.db.select().from(stacks);
  const totalCount = items.length;
  const totalPages = Math.ceil(totalCount / input.pageSize);

  return {
    items,
    page: input.page,
    pageSize: input.pageSize,
    totalCount,
    totalPages,
  };
}

// Use in components
type StacksListProps = {
  data: PaginatedResponse<Stack>;
};
```

---

## Recipe 8: Discriminated Union for State Machine

**Problem**: Model entity with status-dependent fields.

```typescript
type BaseStack = {
  id: string;
  name: string;
  warehouseId: string;
  createdAt: Date;
};

type OpenStack = BaseStack & {
  status: "open";
  closedAt: null;
  verifiedAt: null;
};

type ClosedStack = BaseStack & {
  status: "closed";
  closedAt: Date;
  closedBy: string;
  verifiedAt: null;
};

type VerifiedStack = BaseStack & {
  status: "verified";
  closedAt: Date;
  closedBy: string;
  verifiedAt: Date;
  verifiedBy: string;
};

type Stack = OpenStack | ClosedStack | VerifiedStack;

// Type-safe handler
function processStack(stack: Stack) {
  switch (stack.status) {
    case "open":
      // TypeScript knows closedAt is null
      console.log("Stack is open");
      break;
    case "closed":
      // TypeScript knows closedAt and closedBy exist
      console.log(`Closed at ${stack.closedAt} by ${stack.closedBy}`);
      break;
    case "verified":
      // TypeScript knows all verification fields exist
      console.log(`Verified at ${stack.verifiedAt} by ${stack.verifiedBy}`);
      break;
  }
}
```

---

## Recipe 9: Custom Type Guards

**Problem**: Need runtime type checking with compile-time narrowing.

```typescript
// Null/undefined guard
function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

// Status guard
type StackStatus = 'open' | 'closed' | 'verified';
function isClosedOrVerified(status: StackStatus): status is 'closed' | 'verified' {
  return status === 'closed' || status === 'verified';
}

// Entity type guard
interface Stack {
  id: string;
  status: StackStatus;
  closedAt?: Date;
}

function isClosedStack(stack: Stack): stack is Stack & { closedAt: Date } {
  return stack.status === 'closed' && stack.closedAt !== undefined;
}

// Usage
const stacks: (Stack | null)[] = [...];
const validStacks = stacks.filter(isNonNullable);

const closedStacks = validStacks.filter(isClosedStack);
// TypeScript knows closedAt exists in closedStacks
```

---

## Recipe 10: Component with Extended Props

**Problem**: Extend base component props with custom fields.

```typescript
import type { ButtonHTMLAttributes } from 'react';
import { Button } from '@/components/ui/button';

// Extend HTML button props
type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  loadingText?: string;
};

export function LoadingButton({
  isLoading,
  loadingText = 'Loading...',
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

// Extend shadcn component props
import type { DialogProps } from '@/components/ui/dialog';

type ConfirmDialogProps = DialogProps & {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
};
```

---

## Recipe 11: Pick/Omit/Partial Patterns

**Problem**: Create variations of existing types.

```typescript
type Stack = {
  id: string;
  name: string;
  warehouseId: string;
  status: "open" | "closed";
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
};

// Pick specific fields
type StackSummary = Pick<Stack, "id" | "name" | "status">;

// Omit fields
type StackWithoutTimestamps = Omit<Stack, "createdAt" | "updatedAt">;

// All fields optional (for updates)
type StackUpdate = Partial<Stack>;

// Combine techniques
type StackFormData = Omit<Stack, "id" | "createdAt" | "updatedAt"> & {
  tempId?: string;
};

// Make specific fields required
type StackRequired = Required<Pick<Stack, "name" | "warehouseId">> &
  Partial<Omit<Stack, "name" | "warehouseId">>;
```

---

## Recipe 12: Router Input Types

**Problem**: Need to type variables matching tRPC procedure inputs.

```typescript
import type { RouterInputs } from "@/lib/api/client";

// Query input
type ListStacksInput = RouterInputs["stacks"]["list"];
type GetStackInput = RouterInputs["stacks"]["get"];

// Mutation input
type CreateStackInput = RouterInputs["stacks"]["create"];
type UpdateStackInput = RouterInputs["stacks"]["update"];

// Use in handlers
async function loadStacks(filters: Partial<ListStacksInput>) {
  const input: ListStacksInput = {
    page: 1,
    pageSize: 50,
    ...filters,
  };

  return await api.stacks.list.query(input);
}
```

---

## Recipe 13: Extract Return Type from Function

**Problem**: Need type for what a function returns without calling it.

```typescript
// Async function
async function fetchStacks() {
  return { items: [], total: 0 };
}

type FetchStacksResult = Awaited<ReturnType<typeof fetchStacks>>;
// { items: never[]; total: number }

// Sync function
function formatStack(stack: Stack) {
  return { id: stack.id, display: `${stack.name} (${stack.status})` };
}

type FormattedStack = ReturnType<typeof formatStack>;
// { id: string; display: string }
```

---

## Recipe 14: Zod Transform Types

**Problem**: Need type for transformed Zod schema output.

```typescript
const inputSchema = z.object({
  name: z.string(),
  lengthMm: z.string().transform((val) => parseInt(val, 10)),
});

type Input = z.input<typeof inputSchema>;
// { name: string; lengthMm: string }

type Output = z.output<typeof inputSchema>;
// { name: string; lengthMm: number }

// Use in form
const form = useForm<Input>({
  resolver: zodResolver(inputSchema),
});

// After validation, data matches Output type
const onSubmit = form.handleSubmit((data: Output) => {
  console.log(data.lengthMm); // number
});
```

---

## Recipe 15: Mutation Context Types

**Problem**: Need proper types for command context parameters.

```typescript
import type { Database } from "@/lib/db/client";

// Base mutation context (most mutations)
export type BaseMutationContext = {
  db: Database;
  userId: string;
  now?: () => Date;
  requestId?: string | null;
  ipAddress?: string | null;
};

// Extended with observability (audit-heavy operations)
export type MutationContext = BaseMutationContext & {
  logger: Logger;
  eventPublisher: EventPublisher;
};

// Query context (read-only)
export type QueryContext = {
  db: Database;
};

// Use in commands
export async function createStack(
  ctx: BaseMutationContext,
  input: CreateStackInput,
): Promise<Stack> {
  const now = ctx.now?.() ?? new Date();
  const [stack] = await ctx.db
    .insert(stacks)
    .values({
      ...input,
      createdBy: ctx.userId,
      createdAt: now,
    })
    .returning();

  return stack;
}
```

---

## Quick Reference

| Task               | Solution                                           |
| ------------------ | -------------------------------------------------- |
| List item type     | `RouterOutputs['router']['list']['items'][number]` |
| Entity type        | `RouterOutputs['router']['get']`                   |
| Form type          | `z.infer<typeof schema>`                           |
| Mutation input     | `RouterInputs['router']['mutation']`               |
| Paginated response | `PaginatedResponse<T>`                             |
| Async return type  | `Awaited<ReturnType<typeof fn>>`                   |
| Pick fields        | `Pick<T, 'field1' \| 'field2'>`                    |
| Omit fields        | `Omit<T, 'field1' \| 'field2'>`                    |
| Optional fields    | `Partial<T>`                                       |
| Required fields    | `Required<T>`                                      |
| Non-nullable       | `NonNullable<T>`                                   |
| Array element      | `T[number]`                                        |
| Nested property    | `T['prop']['nested']`                              |
