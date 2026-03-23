# @poseui/store

Reactive state management for vanilla TypeScript, backed by [alien-signals](https://github.com/stackblitz/alien-signals).

```ts
import { createStore } from "@poseui/store";
import { createPose } from "poseui";
import { tailwind4 } from "poseui/presets/tailwind4";

const pose = createPose({ presets: [tailwind4] });

const counter = pose
  .as("p")
  .text_2xl()
  .font_bold()
  .input(z.object({ count: z.number() }))
  .child(({ count }) => `Count: ${count}`);

const store = createStore({ count: 0 }, (set) => ({
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
```

## Core concepts

**`createStore(initialState, actions?)`** — creates a store. Pass initial state as a plain object as the first argument, and an optional actions creator as the second. The actions creator receives `set`, `get`, and `getInitialState`, and returns only the action functions. Returns a `StoreApi` with `getState`, `setState`, `subscribe`, `getInitialState`, and `bind`.

**No explicit generics needed** — TypeScript infers the state type from the first argument and the action types from the return value of the creator. No type annotations or curried forms required:

```ts
// State only — T inferred from the object literal
const store = createStore({ count: 0, name: "Ada" });

// State + actions — both inferred, no annotation needed
const store = createStore({ count: 0 }, (set, _get, getInitialState) => ({
  inc: () => set((s) => ({ count: s.count + 1 })),
  reset: () => set(getInitialState()),
}));

store.getState().count; // number ✓
store.getState().inc; // () => void ✓
```

**`get` returns the full state including actions** — actions can call each other via `get()`:

```ts
const store = createStore({ count: 0 }, (set, get) => ({
  inc: () => set((s) => ({ count: s.count + 1 })),
  incThenDouble: () => {
    get().inc();
    set((s) => ({ count: s.count * 2 }));
  },
}));
```

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

Returns the original initial state object — not affected by subsequent `setState` calls. Useful as a reset reference:

```ts
store.setState(store.getInitialState()); // reset to initial values
```

Note: `getInitialState()` returns the state shape only (the first argument to `createStore`), not the action functions.

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

const store = createStore(
  {
    errors: {} as Record<string, string[]>,
    submitted: false,
  },
  (set) => ({
    setErrors: (errors: Record<string, string[]>) => set({ errors }),
    setSubmitted: () => set({ submitted: true }),
  }),
);

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

## License

MIT
