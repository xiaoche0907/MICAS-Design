# TypeScript Examples from Atlas

Real-world TypeScript patterns from the Atlas codebase showing complete type flows.

## Example 1: Stack Management - Complete Type Flow

### Schema Definition (Drizzle)

```typescript
// src/lib/db/schema/stacks.ts
import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  decimal,
  integer,
  uuid,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const stackStatusEnum = pgEnum("stack_status", [
  "open",
  "closed",
  "in_verification",
  "verified",
  "certified",
  "in_loading",
  "finished",
]);

export const stacks = pgTable("stacks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  clientId: uuid("client_id").notNull(),
  warehouseId: uuid("warehouse_id").notNull(),
  lengthMm: integer("length_mm").notNull(),
  status: stackStatusEnum("status").notNull().default("open"),
  yardGridCode: text("yard_grid_code"),
  totalM3JAS: decimal("total_m3_jas", { precision: 12, scale: 4 }).default("0"),
  totalTons: decimal("total_tons", { precision: 10, scale: 3 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: uuid("created_by").notNull(),
});

// Drizzle-inferred types
export type Stack = typeof stacks.$inferSelect;
export type NewStack = typeof stacks.$inferInsert;
export type StackStatus = (typeof stackStatusEnum.enumValues)[number];

// Zod schemas
export const selectStackSchema = createSelectSchema(stacks);
export const stackStatusSchema = z.enum([
  "open",
  "closed",
  "in_verification",
  "verified",
  "certified",
  "in_loading",
  "finished",
]);
```

### Query Definition (Command)

```typescript
// src/lib/api/commands/queries/stacks/list-map.query.ts
import { z } from "zod";
import type { QueryContext } from "../types";

const stackStatusEnum = z.enum([
  "open",
  "closed",
  "in_verification",
  "verified",
  "certified",
]);

export const listMapInputSchema = z
  .object({
    warehouseId: z.string().uuid().optional(),
    status: z.array(stackStatusEnum).optional(),
    clientId: z.string().uuid().optional(),
    lengthMm: z.number().int().optional(),
    search: z.string().optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(50),
  })
  .strict();

export const listMapOutputSchema = z
  .object({
    items: z.array(
      z
        .object({
          stackId: z.string().uuid(),
          name: z.string(),
          yardGridCode: z.string().nullable(),
          status: stackStatusEnum,
          warehouseId: z.string().uuid(),
          clientId: z.string().uuid(),
          lengthMm: z.number().int(),
          totals: z
            .object({
              totalM3JAS: z.string(),
              totalTons: z.string(),
            })
            .strict(),
        })
        .strict(),
    ),
    page: z.number().int(),
    pageSize: z.number().int(),
    totalCount: z.number().int(),
    totalPages: z.number().int(),
  })
  .strict();

export type ListMapInput = z.infer<typeof listMapInputSchema>;
export type ListMapOutput = z.infer<typeof listMapOutputSchema>;

export async function listMapQuery(
  { db }: QueryContext,
  input: ListMapInput,
): Promise<ListMapOutput> {
  // Query implementation
  const stacksList = await db.select().from(stacks);

  return {
    items: stacksList.map((stack) => ({
      stackId: stack.id,
      name: stack.name,
      yardGridCode: stack.yardGridCode,
      status: stack.status as z.infer<typeof stackStatusEnum>,
      warehouseId: stack.warehouseId,
      clientId: stack.clientId,
      lengthMm: stack.lengthMm,
      totals: {
        totalM3JAS: String(stack.totalM3JAS),
        totalTons: String(stack.totalTons),
      },
    })),
    page: input.page,
    pageSize: input.pageSize,
    totalCount: stacksList.length,
    totalPages: Math.ceil(stacksList.length / input.pageSize),
  };
}
```

### Router Integration (tRPC)

```typescript
// src/lib/api/routers/stacks.router.ts
import { createTRPCRouter, rbacProcedure } from "../trpc";
import {
  listMapInputSchema,
  listMapOutputSchema,
  listMapQuery,
} from "../commands/queries/stacks/list-map.query";
import { mapAppErrorToTRPC } from "../trpc-error-mapper";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const stacksRouter = createTRPCRouter({
  listMap: rbacProcedure
    .input(listMapInputSchema.strict())
    .output(listMapOutputSchema)
    .query(async ({ ctx, input }) => {
      try {
        assertMasterDataPermission(
          ctx,
          PERMISSIONS.STACK_VIEW,
          "You do not have permission to view stacks",
        );
        return await listMapQuery({ db: ctx.db }, input);
      } catch (error) {
        throw mapAppErrorToTRPC(error);
      }
    }),
});
```

### Client Component (React)

```typescript
// src/components/features/stacks/StacksListClient.tsx
'use client';

import type { RouterOutputs } from '@/lib/api/client';
import { api } from '@/lib/api/client';
import { useState, useMemo } from 'react';

// Derive types from router outputs
type StackItem = RouterOutputs['stacks']['listMap']['items'][number];
type StackStatus = StackItem['status'];

type StackFilters = {
  search: string;
  warehouseId?: string;
  status: StackStatus[];
};

type Props = {
  initialPage: number;
  initialPageSize: number;
};

export function StacksListClient({ initialPage, initialPageSize }: Props) {
  const [page, setPage] = useState(initialPage);
  const [pageSize] = useState(initialPageSize);
  const [filters, setFilters] = useState<StackFilters>({
    search: '',
    status: [],
  });

  // Memoized query input
  const queryInput = useMemo(
    () => ({
      page,
      pageSize,
      search: filters.search || undefined,
      warehouseId: filters.warehouseId,
      status: filters.status.length > 0 ? filters.status : undefined,
    }),
    [page, pageSize, filters],
  );

  // Type-safe query
  const { data, isLoading, error } = api.stacks.listMap.useQuery(queryInput, {
    placeholderData: previousData => previousData,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return (
    <div>
      <StacksTable
        stacks={data.items}
        page={page}
        total={data.totalCount}
      />
    </div>
  );
}

// Presentational component with derived types
type StacksTableProps = {
  stacks: StackItem[];
  page: number;
  total: number;
};

function StacksTable({ stacks, page, total }: StacksTableProps) {
  return (
    <table>
      <tbody>
        {stacks.map(stack => (
          <tr key={stack.stackId}>
            <td>{stack.name}</td>
            <td>{stack.status}</td>
            <td>{stack.totals.totalM3JAS} m³</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## Example 2: Delivery Notes with Discriminated Unions

### Type Definitions

```typescript
// src/lib/api/commands/mutations/delivery-notes/types.ts
export type DeliveryNoteStatus =
  | "draft"
  | "assigned"
  | "in_transit"
  | "arrived"
  | "completed"
  | "cancelled";

// Discriminated union based on status
type BaseDeliveryNote = {
  id: string;
  name: string;
  truckId: string;
  supplierId: string;
  createdAt: Date;
  updatedAt: Date;
};

type DraftDeliveryNote = BaseDeliveryNote & {
  status: "draft";
  stackId: null;
  assignedAt: null;
  completedAt: null;
};

type AssignedDeliveryNote = BaseDeliveryNote & {
  status: "assigned" | "in_transit" | "arrived";
  stackId: string;
  assignedAt: Date;
  completedAt: null;
};

type CompletedDeliveryNote = BaseDeliveryNote & {
  status: "completed";
  stackId: string;
  assignedAt: Date;
  completedAt: Date;
  finalWeightKg: number;
};

type CancelledDeliveryNote = BaseDeliveryNote & {
  status: "cancelled";
  stackId: string | null;
  assignedAt: Date | null;
  completedAt: null;
  cancellationReason: string;
};

export type DeliveryNote =
  | DraftDeliveryNote
  | AssignedDeliveryNote
  | CompletedDeliveryNote
  | CancelledDeliveryNote;
```

### Status Control Component

```typescript
// src/components/features/delivery-notes/StatusControls.tsx
'use client';

import type { RouterOutputs } from '@/lib/api/client';
import { api } from '@/lib/api/client';

type DeliveryNote = RouterOutputs['deliveryNotes']['get'];
type DeliveryNoteStatus = DeliveryNote['status'];

type Props = {
  deliveryNote: DeliveryNote;
};

export function StatusControls({ deliveryNote }: Props) {
  const updateStatusMutation = api.deliveryNotes.updateStatus.useMutation();

  // Type-safe status handling
  const handleStatusChange = (newStatus: DeliveryNoteStatus) => {
    updateStatusMutation.mutate({
      id: deliveryNote.id,
      status: newStatus,
    });
  };

  // Type narrowing with discriminated union
  switch (deliveryNote.status) {
    case 'draft':
      return (
        <div>
          <p>No stack assigned</p>
          <Button onClick={() => handleStatusChange('assigned')}>
            Assign Stack
          </Button>
        </div>
      );

    case 'assigned':
    case 'in_transit':
      // TypeScript knows stackId is non-null here
      return (
        <div>
          <p>Stack: {deliveryNote.stackId}</p>
          <p>Assigned: {deliveryNote.assignedAt.toLocaleString()}</p>
          <Button onClick={() => handleStatusChange('arrived')}>
            Mark Arrived
          </Button>
        </div>
      );

    case 'arrived':
      return (
        <div>
          <Button onClick={() => handleStatusChange('completed')}>
            Complete Delivery
          </Button>
        </div>
      );

    case 'completed':
      // TypeScript knows all completion fields exist
      return (
        <div>
          <p>Completed: {deliveryNote.completedAt.toLocaleString()}</p>
          <p>Final Weight: {deliveryNote.finalWeightKg} kg</p>
        </div>
      );

    case 'cancelled':
      // TypeScript knows cancellation reason exists
      return (
        <div>
          <p>Cancelled: {deliveryNote.cancellationReason}</p>
        </div>
      );

    default:
      // Exhaustiveness check
      const _exhaustive: never = deliveryNote;
      return null;
  }
}
```

---

## Example 3: Form with Zod Validation

### Schema Definition

```typescript
// src/lib/validation/schemas/stacks.ts
import { z } from "zod";

export const createStackSchema = z
  .object({
    name: z
      .string()
      .min(1, "Stack name is required")
      .max(100, "Stack name too long"),
    clientId: z.string().uuid("Invalid client ID"),
    warehouseId: z.string().uuid("Invalid warehouse ID"),
    lengthMm: z
      .number()
      .int("Length must be a whole number")
      .positive("Length must be positive")
      .min(1000, "Minimum length is 1000mm")
      .max(15000, "Maximum length is 15000mm"),
    yardGridCode: z
      .string()
      .regex(/^[A-Z]-\d{2}$/, "Invalid grid code format (e.g., A-12)")
      .optional(),
  })
  .strict();

export type CreateStackInput = z.infer<typeof createStackSchema>;
```

### Form Component

```typescript
// src/components/features/stacks/StackOpenDialog.tsx
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api/client';
import { createStackSchema } from '@/lib/validation/schemas/stacks';
import type { CreateStackInput } from '@/lib/validation/schemas/stacks';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Props = {
  warehouses: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string }>;
  onSuccess: (stackId: string) => void;
};

export function StackOpenDialog({ warehouses, clients, onSuccess }: Props) {
  // Type-safe form with Zod resolver
  const form = useForm<CreateStackInput>({
    resolver: zodResolver(createStackSchema),
    defaultValues: {
      name: '',
      clientId: '',
      warehouseId: '',
      lengthMm: 3000,
      yardGridCode: '',
    },
  });

  const createMutation = api.stacks.create.useMutation({
    onSuccess: (data) => {
      form.reset();
      onSuccess(data.id);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Type-safe submit handler
  const onSubmit = form.handleSubmit(async (data: CreateStackInput) => {
    await createMutation.mutateAsync(data);
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stack Name</FormLabel>
              <FormControl>
                <Input {...field} placeholder="STACK-2024-001" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="warehouseId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Warehouse</FormLabel>
              <FormControl>
                <select {...field}>
                  <option value="">Select warehouse</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="lengthMm"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Length (mm)</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  onChange={e => field.onChange(parseInt(e.target.value, 10))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? 'Creating...' : 'Create Stack'}
        </Button>
      </form>
    </Form>
  );
}
```

---

## Example 4: Mutation Context Types

### Context Type Definitions

```typescript
// src/lib/api/commands/mutations/types.ts
import type { Database } from "@/lib/db/client";
import type { EventPublisher } from "@/lib/observability/event-publisher";
import type { Logger } from "@/lib/observability/logger";

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
```

### Mutation Implementation

```typescript
// src/lib/api/commands/mutations/stacks/close.mutation.ts
import { z } from "zod";
import type { BaseMutationContext } from "../types";
import { stacks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NotFoundError, InvalidStateError } from "@/lib/errors";

export const closeStackInputSchema = z
  .object({
    stackId: z.string().uuid(),
    photoUrl: z.string().url(),
  })
  .strict();

export const closeStackOutputSchema = z
  .object({
    id: z.string().uuid(),
    status: z.literal("closed"),
    closedAt: z.date(),
    closedBy: z.string().uuid(),
  })
  .strict();

export type CloseStackInput = z.infer<typeof closeStackInputSchema>;
export type CloseStackOutput = z.infer<typeof closeStackOutputSchema>;

export async function closeStackMutation(
  ctx: BaseMutationContext,
  input: CloseStackInput,
): Promise<CloseStackOutput> {
  const now = ctx.now?.() ?? new Date();

  return await ctx.db.transaction(async (tx) => {
    // Fetch stack
    const [stack] = await tx
      .select()
      .from(stacks)
      .where(eq(stacks.id, input.stackId));

    if (!stack) {
      throw new NotFoundError("Stack", input.stackId);
    }

    if (stack.status !== "open") {
      throw new InvalidStateError("Cannot close a stack that is not open");
    }

    // Update stack
    const [closedStack] = await tx
      .update(stacks)
      .set({
        status: "closed",
        closedAt: now,
        closedBy: ctx.userId,
        updatedAt: now,
        updatedBy: ctx.userId,
      })
      .where(eq(stacks.id, input.stackId))
      .returning();

    // Record photo
    await tx.insert(stackPhotos).values({
      stackId: input.stackId,
      url: input.photoUrl,
      photoType: "closure",
      uploadedBy: ctx.userId,
      uploadedAt: now,
    });

    return {
      id: closedStack.id,
      status: "closed",
      closedAt: closedStack.closedAt!,
      closedBy: closedStack.closedBy!,
    };
  });
}
```

### Router Usage

```typescript
// src/lib/api/routers/stacks.router.ts
export const stacksRouter = createTRPCRouter({
  close: rbacProcedure
    .input(closeStackInputSchema.strict())
    .output(closeStackOutputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        requireStackOpenClosePermission(ctx);
        const dbUserId = getDbUserIdOrThrow(ctx);

        const mutationResult = await closeStackMutation(
          {
            db: ctx.db,
            userId: dbUserId,
            requestId: ctx.requestId,
            ipAddress: ctx.ipAddress,
          },
          input,
        );

        return mutationResult;
      } catch (error) {
        throw mapAppErrorToTRPC(error);
      }
    }),
});
```

---

## Example 5: Complex Nested Entity Types

### User Stats with Role Breakdown

```typescript
// src/lib/api/commands/queries/users/get-stats.query.ts
import { z } from "zod";
import type { QueryContext } from "../types";

const roleStatsSchema = z
  .object({
    role: z.string(),
    count: z.number().int(),
    activeCount: z.number().int(),
  })
  .strict();

export const getUserStatsOutputSchema = z
  .object({
    totalUsers: z.number().int(),
    activeUsers: z.number().int(),
    inactiveUsers: z.number().int(),
    byRole: z.array(roleStatsSchema),
    recentlyCreated: z.number().int(),
  })
  .strict();

export type GetUserStatsOutput = z.infer<typeof getUserStatsOutputSchema>;
```

### Component Using Stats

```typescript
// src/components/features/user-management/StatsCards.tsx
'use client';

import type { RouterOutputs } from '@/lib/api/client';

type UserStats = RouterOutputs['users']['getUserStats'];

type Props = {
  stats: UserStats;
};

export function StatsCards({ stats }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>Total Users</CardHeader>
        <CardContent>{stats.totalUsers}</CardContent>
      </Card>

      <Card>
        <CardHeader>Active Users</CardHeader>
        <CardContent>{stats.activeUsers}</CardContent>
      </Card>

      <Card>
        <CardHeader>Recently Created</CardHeader>
        <CardContent>{stats.recentlyCreated}</CardContent>
      </Card>

      <div className="col-span-full">
        <h3>Users by Role</h3>
        <ul>
          {stats.byRole.map(role => (
            <li key={role.role}>
              {role.role}: {role.count} ({role.activeCount} active)
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

---

## Key Patterns Demonstrated

1. **Schema → Type Flow**: Drizzle schema → Zod schema → inferred types
2. **Router Type Derivation**: `RouterOutputs` for UI types
3. **Discriminated Unions**: Status-based type narrowing
4. **Form Validation**: Zod + react-hook-form integration
5. **Context Types**: Typed mutation/query contexts
6. **Nested Types**: Complex objects with type safety
7. **Type Guards**: Runtime checks with compile-time narrowing
8. **Paginated Responses**: Consistent pagination contract
9. **Error Handling**: Typed error mapping
10. **Component Props**: Derived from router outputs
