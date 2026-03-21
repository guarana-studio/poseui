# poseui

> ⚠️ Prototype — the API is unstable. The libraries haven't been published to NPM yet, use [the nightly builds](https://pkg.pr.new/~/guarana-studio/poseui).

Type-safe HTML for vanilla TypeScript. No framework, no virtual DOM, no compiler — just typed components, reactive state, and clean DOM bindings.

## Packages

| Package                             | Description                              |
| ----------------------------------- | ---------------------------------------- |
| [`poseui`](./packages/poseui)       | Core templating engine                   |
| [`@poseui/on`](./packages/on)       | Typed DOM event registration             |
| [`@poseui/form`](./packages/form)   | Typed form binding via Standard Schema   |
| [`@poseui/store`](./packages/store) | Reactive state backed by alien-signals   |
| [`@poseui/match`](./packages/match) | Typed pattern matching for plain objects |

---

## `poseui`

Fluent builder that produces typed HTML strings. CSS is your concern — pose just builds the markup.

```ts
import { createPose } from "poseui";
import { tailwind4 } from "poseui/presets/tailwind4";
import { z } from "zod";

const pose = createPose({ presets: [tailwind4] });

const button = pose
  .as("button")
  .input(
    z.object({
      variant: z.enum(["primary", "secondary"]).default("primary"),
      disabled: z.boolean().default(false),
    }),
  )
  .px(4)
  .py(2)
  .rounded()
  .font_semibold()
  .transition()
  .when("variant", {
    primary: (b) => b.bg("indigo-600").text_color("white"),
    secondary: (b) => b.bg("slate-200").text_color("slate-900"),
  })
  .when(
    ({ disabled }) => disabled,
    (b) => b.opacity(50).cursor_not_allowed(),
  )
  .child(({ variant }) => (variant === "primary" ? "Submit" : "Cancel"));

button({ variant: "primary" });
// → <button class="px-4 py-2 rounded font-semibold transition bg-indigo-600 text-white">Submit</button>
```

For larger layouts, use the `html` tagged template literal to compose multiple elements into a single typed template:

```ts
import { html } from "poseui";

const card = pose.as("div").cls("rounded-xl shadow-md p-6 bg-white");
const loginForm = pose.as("form").attr("method", "post");
const emailLabel = pose.as("label").cls("text-sm font-medium").attr("for", "email");
const emailInput = pose.as("input").cls("form-input w-full").attrs({ type: "email", id: "email" });
const cardFooter = pose.as("footer").cls("mt-4 flex justify-end gap-2");
const loginBtn = pose.as("button").cls("btn-primary").attr("type", "submit");
const googleBtn = pose.as("button").cls("btn-outline").attr("type", "button");

const loginCard = html`
  <div ${card}>
    <header>
      <h2 class="text-xl font-semibold">Login to your account</h2>
    </header>
    <section class="mt-4">
      <form ${loginForm}>
        <div class="grid gap-2">
          <label ${emailLabel}>Email</label>
          <input ${emailInput} />
        </div>
      </form>
    </section>
    <footer ${cardFooter}>
      <button ${loginBtn}>Login</button>
      <button ${googleBtn}>Login with Google</button>
    </footer>
  </div>
`;

loginCard();
```

When a `PoseElement` appears inside an opening tag (`<div ${card}>`), its classes and attributes are spread onto the host tag. Elsewhere it renders in full. Pass a type parameter to thread typed props through all slots:

```ts
type Props = { username: string; error: string | null };

const errorMsg = pose
  .as("p")
  .cls("text-sm text-red-500")
  .input(z.object({ error: z.string().nullable() }))
  .child(({ error }) => error);

const form = html<Props>`
  <form method="post">
    <input type="text" name="username" value="${({ username }) => username}" />
    ${({ error }) => (error ? errorMsg : null)}
    <button type="submit">Log in</button>
  </form>
`;

form({ username: "ada", error: "Invalid password" });
```

```bash
bun add poseui
bun add zod  # or valibot, arktype — any Standard Schema lib
```

---

## `@poseui/on`

Typed DOM event registration. Declare targets and handlers up front, mount when your HTML is ready, clean up with a single call.

```ts
import { createEventMap } from "@poseui/on";

const events = createEventMap();

events.target<HTMLButtonElement>("#submit").on("click", (e) => {
  e.currentTarget.disabled = true;
});

events.targets<HTMLInputElement>("form input").on("change", () => store.getState().markDirty());

const unmount = events.mount(document.querySelector("#app"));
unmount(); // removes every listener at once
```

```bash
bun add @poseui/on
```

---

## `@poseui/form`

Bind any `<form>` element to a Standard Schema. Typed values on submit, per-field errors, optional live validation — without touching your markup.

```ts
import { createForm } from "@poseui/form";
import { z } from "zod";

const form = createForm({
  target: "#signup",
  schema: z.object({
    email: z.string().email("Invalid email"),
    age: z.coerce.number().min(18, "Must be 18 or older"),
  }),
  validateOn: "change",
  onSubmit(values) {
    // values.email → string, values.age → number
    api.send(values);
  },
  onError() {
    store.getState().setErrors(form.errors());
  },
});

const unmount = form.mount();
```

```bash
bun add @poseui/form
```

---

## `@poseui/store`

Reactive state backed by [alien-signals](https://github.com/stackblitz/alien-signals). Familiar if you know zustand — `createStore`, `getState`, `setState`, `subscribe` — plus `bind()`, which connects state directly to a pose element and handles re-rendering automatically.

```ts
import { createStore, effectScope } from "@poseui/store";

const store = createStore<{
  errors: Record<string, string[]>;
  dirty: boolean;
  setErrors: (e: Record<string, string[]>) => void;
  markDirty: () => void;
}>()((set) => ({
  errors: {},
  dirty: false,
  setErrors: (errors) => set({ errors }),
  markDirty: () => set({ dirty: true }),
}));

// Re-renders only when errors change — other state changes are ignored
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
});

stop(); // tears down all bindings at once
```

```bash
bun add @poseui/store
bun add alien-signals
```

---

## `@poseui/match`

Typed pattern matching for plain objects. Chain `.when()` conditions and collect results — the default output type is `string`, making it ergonomic for building class strings.

```ts
import { match } from "@poseui/match";

const classes = match({ variant: "primary", size: "lg", disabled: true })
  .when("variant", {
    primary: "bg-indigo-600 text-white",
    secondary: "bg-slate-200 text-slate-900",
  })
  .when("size", { sm: "px-2 py-1 text-sm", lg: "px-6 py-3 text-lg" })
  .when(({ disabled }) => disabled, "opacity-50 cursor-not-allowed")
  .resolve();
// → "bg-indigo-600 text-white px-6 py-3 text-lg opacity-50 cursor-not-allowed"
```

```bash
bun add @poseui/match
```

---

## Putting it together

All five packages compose without coupling. Here's what a real contact form looks like when each package does its job:

```ts
import { createPose } from "poseui";
import { tailwind4 } from "poseui/presets";
import { createEventMap } from "@poseui/on";
import { createForm } from "@poseui/form";
import { createStore, effectScope } from "@poseui/store";
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

// ── Form ──────────────────────────────────────────────────────

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

// ── Bindings ──────────────────────────────────────────────────

effectScope(() => {
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

// ── Events ────────────────────────────────────────────────────

const events = createEventMap();
events.target<HTMLTextAreaElement>("#message").on("input", (e) => {
  document.getElementById("char-count")!.textContent = `${e.currentTarget.value.length} / 500`;
});
events
  .targets<HTMLInputElement | HTMLTextAreaElement>("#contact input, #contact textarea")
  .on("change", () => store.getState().markDirty());
events.mount();
```

`poseui` defines components. `@poseui/store` owns state. `@poseui/form` runs validation. `@poseui/on` wires events. Each does one thing and composes cleanly with the rest.

---

## License

MIT
