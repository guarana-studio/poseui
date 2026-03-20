# @poseui/store

Reactive state management for vanilla TypeScript, backed by [alien-signals](https://github.com/stackblitz/alien-signals). The API mirrors [zustand/vanilla](https://github.com/pmndrs/zustand) — `createStore`, `getState`, `setState`, `subscribe` — with one addition: `bind()` connects state directly to a DOM element via a pose render function, eliminating manual `innerHTML` management.

```ts
import { createStore } from "@poseui/store";
import { createPose } from "poseui";
import { tailwind4 } from "poseui/tailwind4";

const pose = createPose({ presets: [tailwind4] });

const counter = pose
  .as("p")
  .text_2xl()
  .font_bold()
  .input(z.object({ count: z.number() }))
  .child(({ count }) => `Count: ${count}`);

const store = createStore<{ count: number; inc: () => void; dec: () => void }>()((set) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),
  dec: () => set((s) => ({ count: s.count - 1 })),
}));

// Renders immediately, re-renders on every count change
store.bind(
  document.getElementById("counter")!,
  (s) => s.count,
  (count) => counter({ count }),
);

document.getElementById("inc")?.addEventListener("click", () => store.getState().inc());
document.getElementById("dec")?.addEventListener("click", () => store.getState().dec());
```

## Install

```bash
bun add @poseui/store
bun add alien-signals  # peer dependency
```

## Core concepts

**`createStore(creator)`** — creates a store. The creator receives `set`, `get`, and the `api` object. Returns a `StoreApi` with `getState`, `setState`, `subscribe`, `getInitialState`, and `bind`.

**Two call forms** — simple state can be created without a type annotation; state with actions requires the curried form to break TypeScript's circular type inference:

```ts
// Simple — T inferred from the return value
const store = createStore(() => ({ count: 0, name: "Ada" }));

// With actions — use createStore<T>()((set, get, api) => ...) to fix T first
const store = createStore<{
  count: number;
  inc: () => void;
  reset: () => void;
}>()((set, _get, api) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),
  reset: () => set(api.getInitialState()),
}));
```

This is the same pattern as [zustand/vanilla](https://zustand.docs.pmnd.rs/apis/create-store).

---

## API

### `store.getState()`

Read the current state synchronously. Always returns the latest snapshot.

```ts
const { count, inc } = store.getState();
console.log(count); // 0
inc();
console.log(store.getState().count); // 1
```

### `store.setState(update)`

Merge a partial update into state. Accepts a plain object or an updater function.

```ts
store.setState({ count: 5 });
store.setState((s) => ({ count: s.count + 1 }));
```

Shallow merge — keys not included in the update are preserved. Actions survive `setState`.

### `store.getInitialState()`

Returns the state as returned by the creator — not affected by subsequent `setState` calls. Useful as a reset reference:

```ts
store.setState(store.getInitialState()); // reset to initial values
```

### `store.subscribe(listener)`

Subscribe to every state change. The listener receives `(newState, prevState)`. Does **not** fire immediately — only on changes. Returns an unsubscribe function.

```ts
const unsub = store.subscribe((state, prev) => {
  if (state.count !== prev.count) {
    console.log("count:", state.count);
  }
});

unsub(); // stop listening
```

### `store.subscribe(selector, listener)`

Subscribe to a selected slice. The listener fires only when the selected value changes by reference — changes to other parts of state are ignored.

```ts
const unsub = store.subscribe(
  (s) => s.user,
  (user, prevUser) => console.log("user changed:", user),
);
```

### `store.bind(el, render)`

Bind a DOM element to a full-state render function. Renders immediately on call, then re-renders on every state change. Returns an unsubscribe function.

```ts
const unsub = store.bind(document.getElementById("app")!, (state) =>
  appEl({ count: state.count, name: state.name }),
);
```

### `store.bind(el, selector, render)`

Bind a DOM element to a selected slice. Only re-renders when the selected slice changes by reference — the optimal pattern for large stores where only a small part of state affects a given element.

```ts
const unsub = store.bind(
  document.getElementById("nav")!,
  (s) => s.user,
  (user) => navEl({ name: user?.name ?? "Guest" }),
);
```

---

## Cleanup with `effectScope`

`effectScope` is re-exported from alien-signals. Use it to group all bindings and subscriptions belonging to a page section, so they can be torn down with a single call — no need to track individual `unsub` functions.

```ts
import { createStore, effectScope } from "@poseui/store";

const stop = effectScope(() => {
  store.bind(document.getElementById("counter")!, (s) => s.count, renderCounter);
  store.bind(document.getElementById("user")!, (s) => s.user, renderUser);
  store.subscribe((s) => s.errors, syncErrors);
});

// Later — tears down all bindings and subscriptions at once:
stop();
```

This is the recommended teardown pattern for dynamic sections, modals, or any UI region that mounts and unmounts.

---

## With `@poseui/form`

Store actions become the natural integration point for form state:

```ts
import { createStore, effectScope } from "@poseui/store";
import { createForm } from "@poseui/form";
import { z } from "zod";

const store = createStore<{
  errors: Record<string, string[]>;
  submitted: boolean;
  setErrors: (e: Record<string, string[]>) => void;
  setSubmitted: () => void;
}>()((set) => ({
  errors: {},
  submitted: false,
  setErrors: (errors) => set({ errors }),
  setSubmitted: () => set({ submitted: true }),
}));

const form = createForm({
  target: "#signup",
  schema: z.object({
    email: z.string().email(),
    name: z.string().min(1),
  }),
  onSubmit() {
    store.getState().setSubmitted();
  },
  onError() {
    store.getState().setErrors(form.errors());
  },
  validateOn: "change",
});

// Wire errors to DOM via pose
const errorList = pose.as("ul").text_sm().text_color("red-600");

store.bind(
  document.getElementById("errors")!,
  (s) => s.errors,
  (errors) =>
    Object.entries(errors)
      .map(([field, msgs]) => `<li>${field}: ${msgs[0]}</li>`)
      .join(""),
);

form.mount();
```

---

## Full showcase

A contact form where state, rendering, and events each have a clear owner:

```ts
import { createStore, effectScope } from "@poseui/store";
import { createEventMap } from "@poseui/on";
import { createForm } from "@poseui/form";
import { createPose } from "poseui";
import { tailwind4 } from "poseui/tailwind4";
import { z } from "zod";

const pose = createPose({ presets: [tailwind4] });

// ── Components ────────────────────────────────────────────────

const errorMsg = pose
  .as("p")
  .text_sm()
  .text_color("red-500")
  .mt(1)
  .input(z.object({ message: z.string() }))
  .child(({ message }) => message);

const submitBtn = pose
  .as("button")
  .px(6)
  .py(2)
  .rounded()
  .font_semibold()
  .transition()
  .input(z.object({ disabled: z.boolean().default(false) }))
  .when(
    ({ disabled }) => disabled,
    (b) => b.opacity(40).cursor_not_allowed(),
  )
  .when(
    ({ disabled }) => !disabled,
    (b) => b.bg("indigo-600").text_color("white"),
  )
  .attr("type", "submit")
  .child("Send message");

// ── Store ─────────────────────────────────────────────────────

const store = createStore<{
  errors: Record<string, string[]>;
  dirty: boolean;
  setErrors: (e: Record<string, string[]>) => void;
  clearErrors: () => void;
  markDirty: () => void;
}>()((set) => ({
  errors: {},
  dirty: false,
  setErrors: (errors) => set({ errors }),
  clearErrors: () => set({ errors: {} }),
  markDirty: () => set({ dirty: true }),
}));

// ── Form binding ──────────────────────────────────────────────

const form = createForm({
  target: "#contact",
  schema: z.object({
    email: z.string().email("Invalid email"),
    message: z.string().min(10, "At least 10 characters"),
  }),
  validateOn: "change",
  onSubmit() {
    store.getState().clearErrors();
  },
  onError() {
    store.getState().setErrors(form.errors());
  },
});

form.mount();

// ── DOM bindings ──────────────────────────────────────────────

const stop = effectScope(() => {
  store.bind(
    document.getElementById("errors")!,
    (s) => s.errors,
    (errors) =>
      Object.values(errors)
        .flat()
        .map((msg) => errorMsg({ message: msg }))
        .join(""),
  );

  store.bind(
    document.querySelector("[type=submit]")!,
    (s) => s.dirty,
    (dirty) => submitBtn({ disabled: !dirty }),
  );
});

// ── Event wiring ──────────────────────────────────────────────

const events = createEventMap();

events.target<HTMLTextAreaElement>("#message").on("input", (e) => {
  document.getElementById("char-count")!.textContent = `${e.currentTarget.value.length} / 500`;
});

events
  .targets<HTMLInputElement | HTMLTextAreaElement>("#contact input, #contact textarea")
  .on("change", () => store.getState().markDirty());

events.mount();
```

## License

MIT
