# @poseui/match

Typed pattern matching for plain objects. Chain `.when()` conditions against a value, then collect results with `.resolve()`, `.first()`, `.last()`, or `.all()`.

Zero dependencies. No framework required.

```ts
import { match } from "@poseui/match";

const classes = match({ variant: "primary", size: "lg", disabled: true })
  .when("variant", {
    primary: "bg-indigo-600 text-white",
    secondary: "bg-slate-200 text-slate-900",
  })
  .when("size", {
    sm: "px-2 py-1 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  })
  .when(({ disabled }) => disabled, "opacity-50 cursor-not-allowed")
  .resolve();
// → "bg-indigo-600 text-white px-6 py-3 text-lg opacity-50 cursor-not-allowed"
```

## Install

```bash
bun add @poseui/match
```

## Core concepts

**`match(value)`** — create a builder against a plain object. `TOut` defaults to `string`, making class string composition require no type annotation. Pass an explicit second type parameter when producing other output types:

```ts
match(props); // MatchBuilder<typeof props, string>
match<typeof props, number>(props); // MatchBuilder<typeof props, number>
```

**`.when(predicate, result)`** — apply `result` when the predicate returns true. The predicate receives the full input value. `result` can be a static value or a function that also receives the input:

```ts
.when(({ count }) => count > 0, "text-green-600")
.when(({ count }) => count > 0, ({ count }) => `${count} items`)
```

**`.when(key, cases)`** — switch on a key of the input. Cases are `Partial` — unhandled values contribute nothing. Each case value can be static or a function:

```ts
.when("status", {
  ok:      "text-green-600",
  error:   "text-red-600",
  pending: ({ retries }) => retries > 3 ? "text-orange-600" : "text-yellow-600",
})
```

The case keys are typed to `TIn[K] & PropertyKey` — providing a key that doesn't exist in the union is a compile error.

**`.resolve()`** — evaluate all matchers and return results joined with a space when `TOut` is `string`, or as an array otherwise. Returns `""` (or `[]`) when nothing matches. The go-to terminal for class string composition.

**`.all()`** — evaluate all matchers and return every matched result as an array, in registration order.

**`.first()`** — return only the first matched result, or `undefined` if nothing matched. Useful for exclusive switches where at most one case should win.

**`.last()`** — return only the last matched result, or `undefined` if nothing matched. Useful when later matchers are intentionally more specific overrides.

## Chaining and order

Matchers are evaluated in registration order, left to right, every time a terminal is called. Predicate and key-switch matchers can be freely mixed:

```ts
match({ role: "admin", verified: false })
  .when("role", { admin: "font-bold", guest: "font-normal" }) // evaluated first
  .when(({ verified }) => !verified, "text-orange-500") // evaluated second
  .resolve();
// → "font-bold text-orange-500"
```

## Immutability

Each `.when()` call returns a new `MatchBuilder` — the original is unchanged. This makes it safe to branch from a shared base:

```ts
const base = match(props).when("variant", { primary: "bg-indigo-600", secondary: "bg-slate-200" });

const withDisabled = base.when(({ disabled }) => disabled, "opacity-50");
const withLoading = base.when(({ loading }) => loading, "animate-pulse");

// base, withDisabled, and withLoading are independent
```

## Non-string output

Pass an explicit `TOut` to produce values other than strings:

```ts
import type { ComponentType } from "react";

const icon = match<typeof props, ComponentType>(props)
  .when("status", {
    ok: CheckIcon,
    error: XCircleIcon,
    pending: SpinnerIcon,
  })
  .first();
```

## With pose

`match` pairs naturally with pose's `.cls()` escape hatch for cases where you want the full match API rather than the built-in `.when()`:

```ts
import pose from "poseui";
import { match } from "@poseui/match";

const button = pose
  .as("button")
  .input(
    z.object({
      variant: z.enum(["primary", "secondary"]).default("primary"),
      size: z.enum(["sm", "md", "lg"]).default("md"),
      disabled: z.boolean().default(false),
    }),
  )
  .cls((props) =>
    match(props)
      .when("variant", {
        primary: "bg-indigo-600 text-white hover:bg-indigo-700",
        secondary: "bg-slate-200 text-slate-900 hover:bg-slate-300",
      })
      .when("size", {
        sm: "px-2 py-1 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg",
      })
      .when(({ disabled }) => disabled, "opacity-50 cursor-not-allowed")
      .resolve(),
  );
```

## License

MIT
