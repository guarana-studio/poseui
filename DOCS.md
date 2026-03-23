---
title: poseui
description: Typed components, reactive state, clean DOM - no framework required
sideBar:
  extended: true
footer:
  text: Copyright © %YEAR% poseui
---

# poseui

poseui is a TypeScript UI toolkit for building type-safe, prop-driven HTML — without a virtual DOM, a component framework, or a browser runtime. It is designed for teams who want React-level type safety and composability on top of plain HTML strings, whether for server-side rendering, progressive enhancement, or lightweight client-side interactivity.

The toolkit is split into focused packages that compose cleanly. You can use only the parts you need.

---

## Packages

| Package                         | Purpose                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| [`poseui`](#poseui)             | Core builder — typed HTML elements as composable render functions  |
| [`@poseui/on`](#poseuion)       | Typed DOM event registration with deferred, selector-based binding |
| [`@poseui/form`](#poseuiform)   | Schema-validated form binding with error state and dirty tracking  |
| [`@poseui/store`](#poseuistore) | Reactive state store with direct DOM binding via alien-signals     |
| [`@poseui/match`](#poseuimatch) | Typed pattern matching for conditional class and value composition |

---

## How It Fits Together

The packages form a layered stack. Each layer is independently useful but designed to work with the others.

```
┌──────────────────────────────────────────┐
│  poseui — typed HTML builder             │
│  html`` templates · presets · .handler() │
└───────────────────┬──────────────────────┘
                    │ renders HTML strings
        ┌───────────┴───────────┐
        │                       │
┌───────▼──────┐    ┌───────────▼──────────┐
│ @poseui/on   │    │ @poseui/store        │
│ DOM events   │    │ reactive state       │
└───────┬──────┘    └───────────┬──────────┘
        │                       │
┌───────▼──────────────────────▼──────────┐
│ @poseui/form                            │
│ schema-validated forms                  │
└─────────────────────────────────────────┘

@poseui/match — used internally by poseui's .when() and standalone
```

**`poseui`** is the core. Elements are constructed as composable, immutable builder chains. Each element is just a function: call it with props, get an HTML string back.

**`@poseui/on`** handles event binding. Rather than attaching listeners to element nodes, it registers listeners against CSS selectors and defers DOM querying to an explicit `.mount()` call. This means listeners survive `innerHTML` swaps — which is exactly how poseui's `.handler()` and `render()` cycle works.

**`@poseui/form`** adds schema-validated form handling on top of `@poseui/on`. It reads field values via `FormData`, runs them through any Standard Schema validator, and surfaces per-field errors as a flat map — without ever throwing.

**`@poseui/store`** provides reactive state. Its `bind()` method connects a store slice directly to a DOM element, re-rendering it whenever the selected slice changes. Pairs naturally with `@poseui/form` — the form extracts typed values, the store holds application state, and `bind()` keeps the UI in sync.

**`@poseui/match`** is a typed pattern matching utility used internally by poseui's `.when()` builder. It's also useful standalone for composing Tailwind class strings from a props object.

---

## Getting Started

### Installation

```sh
npm install poseui
npm install @poseui/on @poseui/form @poseui/store  # install only what you need
```

### Basic element

```ts
import { createPose } from "poseui";
import { z } from "zod";

const pose = createPose();

const greeting = pose
  .as("p")
  .input(z.object({ name: z.string() }))
  .cls("text-lg font-semibold")
  .child(({ name }) => `Hello, ${name}!`);

greeting({ name: "Ada" });
// → <p class="text-lg font-semibold">Hello, Ada!</p>
```

### Composing elements

Elements compose by passing a `PoseElement` as a `.child()`. Props are threaded automatically — child elements receive the same props as their parent.

```ts
const badge = pose.as("span").cls("badge").child("New");

const card = pose
  .as("div")
  .input(z.object({ title: z.string(), isNew: z.boolean().default(false) }))
  .cls("card")
  .child(({ title }) => title)
  .child(({ isNew }) => (isNew ? badge : null));

card({ title: "Feature", isNew: true });
// → <div class="card">Feature<span class="badge">New</span></div>
```

### Adding interactivity

Close the builder into a mountable `Component` with `.handler()`. Wire DOM events using `@poseui/on`, and call `render()` to update the element without remounting listeners.

```ts
import { createEventMap } from "@poseui/on";

const counter = pose
  .as("div")
  .input(z.object({ count: z.number().default(0) }))
  .child(
    ({ count }) => `
    <span>${count}</span>
    <button id="inc">+</button>
  `,
  )
  .handler(({ render }) => {
    let n = 0;
    events.target<HTMLButtonElement>("#inc").on("click", () => render({ count: ++n }));
  });

const events = createEventMap();
const cleanup = counter.mount(document.querySelector("#app")!, events);
```

### Validated forms

```ts
import { createForm } from "@poseui/form";

const form = createForm({
  target: "#signup",
  schema: z.object({
    email: z.string().email(),
    name: z.string().min(1),
  }),
  onSubmit(values) {
    console.log(values.email, values.name); // fully typed
  },
  onError(issues) {
    // render issues into the UI
  },
  validateOn: "change",
});

form.mount();
```

### Reactive state

```ts
import { createStore } from "@poseui/store";

const store = createStore({ user: null as { name: string } | null }, (set) => ({
  login: (name: string) => set({ user: { name } }),
}));

store.bind(
  document.getElementById("nav")!,
  (s) => s.user,
  (user) => (user ? `<span>Welcome, ${user.name}</span>` : `<a href="/login">Sign in</a>`),
);
```

### Using the `html` template

The `html` tagged template literal composes elements and raw values into larger HTML structures, with props threaded through automatically. `PoseElement`s in an opening-tag position spread their classes and attributes into the host tag.

```ts
import { html } from "poseui";

const card = pose.as("div").cls("card shadow");
const loginBtn = pose.as("button").attr("type", "submit").cls("btn-primary");

const loginForm = html`
  <div ${card}>
    <h2>Sign in</h2>
    <input type="email" name="email" />
    <button ${loginBtn}>Login</button>
  </div>
`;

loginForm();
// → <div class="card shadow"><h2>Sign in</h2>...<button type="submit" class="btn-primary">Login</button></div>
```

### Tailwind and UnoCSS

Add the `tailwind4` preset for a fluent, type-safe API over Tailwind utilities. All static class names are registered in the instance's class registry and can be extracted at build time via `getAllClasses()` or the `poseui/unocss` extractor.

```ts
import { createPose } from "poseui";
import { tailwind4 } from "poseui/presets/tailwind4";

const pose = createPose({ presets: [tailwind4] });

const card = pose.as("div").flex().flex_col().gap(4).p(6).rounded("xl").shadow_md().bg("white");
```

---

## Design Principles

**Elements are functions.** A `PoseElement` is just `(props) => string`. There is no framework, no renderer, no reconciler. Composition is function composition.

**Immutable builders.** Every method on a builder returns a new `PoseElement`. Intermediate elements can be stored and reused as base types for derived components.

**Schema-first props.** Props are validated at render time via Standard Schema. This means Zod, Valibot, ArkType, or any compatible library works out of the box — and schema defaults and transforms apply before any rendering code runs.

**Selector-based events, not node references.** `@poseui/on` binds listeners to CSS selectors against a scoped root, not to specific DOM nodes. This makes listeners survive `innerHTML` swaps, which is the mechanism behind poseui's `render()` function — re-render the HTML, keep the events.

**Synchronous by default.** All rendering, validation, form extraction, and state reads are synchronous. Async schemas are explicitly unsupported where synchronous behaviour is required.

**Zero dependencies in each package.** Every package in the poseui ecosystem carries zero runtime dependencies outside of `alien-signals` (in `@poseui/store`). Standard Schema is inlined as a type-only interface. There is no shared utility package that creates implicit coupling.

---

## Reference

### poseui

`poseui` is a zero-dependency, fully synchronous TypeScript library for building typed HTML elements as composable, prop-driven render functions. It is designed for server-side HTML generation, templating pipelines, and component-based UI construction without a virtual DOM or browser runtime.

Elements are built through a fluent builder API, validated at render time via any [Standard Schema v1](https://standardschema.dev)-compatible library (Zod, Valibot, ArkType, etc.), and rendered to plain HTML strings.

---

#### Core Concepts

##### The Builder

Every element starts from a `Pose` instance created with `createPose()`. Calling `.as(tag)` opens a builder chain that produces a `PoseElement` — a callable function that renders to an HTML string.

```ts
import { createPose } from "poseui";

const pose = createPose();

const greeting = pose.as("p").cls("text-lg").child("Hello, world!");
greeting(); // → <p class="text-lg">Hello, world!</p>
```

Builders are immutable — every method call returns a new `PoseElement` rather than mutating in place.

##### PoseElement

A `PoseElement` is a function that accepts props and returns an HTML string. It carries three type parameters:

- `TProps` — the shape of the props object, inferred from a bound schema
- `TSchema` — the bound Standard Schema validator, or `undefined`
- `TTag` — the HTML tag name, preserved through the chain for attribute type-checking

```ts
const btn = pose
  .as("button")
  .input(z.object({ label: z.string() }))
  .attr("type", "submit")
  .child(({ label }) => label);

btn({ label: "Save" }); // → <button type="submit">Save</button>
```

---

#### API Reference

##### `createPose(options?)`

Creates a new, isolated `Pose` instance. Accepts an optional `options` object:

```ts
const pose = createPose({ presets: [tailwind4, basecoat] });
```

`options.presets` is an array of `Preset` objects that extend every element produced by this instance with additional methods (see [Presets](#presets)).

The instance exposes two methods:

- **`pose.as(tag)`** — begins a builder chain for the given HTML tag. The tag name flows through as `TTag`, which constrains `.attr()` and `.attrs()` to valid attribute names and value types for that element.
- **`pose.getAllClasses()`** — returns a deduplicated, space-separated string of all static class names registered by elements created from this instance. Useful as a virtual source file for Tailwind CLI or UnoCSS.

---

##### `.input(schema)`

Binds a Standard Schema validator. After calling `.input()`, all subsequent methods receive props typed as the schema's output type. Schema defaults and transforms are applied on every render call.

```ts
const el = pose
  .as("div")
  .input(z.object({ count: z.number().default(0) }))
  .child(({ count }) => `Count: ${count}`);

el(); // → <div>Count: 0</div>
el({ count: 5 }); // → <div>Count: 5</div>
```

If validation fails, a `PoseValidationError` is thrown. This error exposes a structured `issues` array matching the Standard Schema v1 `FailureResult` shape.

```ts
import { PoseValidationError } from "poseui";

try {
  el({ count: -1 });
} catch (err) {
  if (err instanceof PoseValidationError) {
    console.log(err.issues); // [{ message: "...", path: [...] }]
  }
}
```

---

##### `.cls(value)`

Appends a class to the element. Accepts a static string or a dynamic function receiving props.

```ts
pose.as("div").cls("rounded shadow");

pose
  .as("div")
  .input(z.object({ active: z.boolean() }))
  .cls(({ active }) => (active ? "ring-2 ring-blue-500" : ""));
```

Multiple `.cls()` calls are accumulated in order. Empty strings returned from dynamic class functions are filtered out.

---

##### `.attr(name, value)`

Sets a single HTML attribute. The attribute name is constrained to valid names for the element's tag, and the value type is inferred from the HTML attribute definition.

```ts
pose.as("a").attr("href", "/home").attr("target", "_blank");

pose
  .as("input")
  .input(z.object({ required: z.boolean() }))
  .attr("required", ({ required }) => (required ? "" : null));
```

`null` omits the attribute from output. An empty string `""` renders as a boolean attribute (`disabled`, `required`, etc.).

Arbitrary `data-*` and `aria-*` attributes are always accepted on any element.

---

##### `.attrs(recordOrFn)`

Sets multiple attributes at once. Accepts either a static record or a props function returning a record. Each key follows the same type constraints as `.attr()`.

```ts
pose.as("input").attrs({ type: "email", placeholder: "you@example.com", required: "" });

pose
  .as("a")
  .input(z.object({ url: z.string(), external: z.boolean() }))
  .attrs(({ url, external }) => ({
    href: url,
    target: external ? "_blank" : null,
    rel: external ? "noopener noreferrer" : null,
  }));
```

---

##### `.child(value)`

Appends a child to the element. Accepts any of:

- A static string or number
- A `PoseElement` (rendered with the current props)
- A function `(props) => ChildValue` where `ChildValue` can be a string, number, `PoseElement`, or an array of the above
- `null` or `undefined` (omitted)

```ts
const badge = pose.as("span").cls("badge").child("New");

const card = pose
  .as("div")
  .input(z.object({ items: z.array(z.string()) }))
  .child(({ items }) => items.map((item) => pose.as("li").child(item)));
```

Props are threaded into child `PoseElement`s automatically, so nested elements receive the same props as their parent without any manual wiring.

---

##### `.when(predOrKey, applyOrCases)`

Applies conditional classes and children based on props. Has two call forms:

**Predicate form** — fires when a function returns `true`:

```ts
pose
  .as("button")
  .input(z.object({ disabled: z.boolean() }))
  .when(
    ({ disabled }) => disabled,
    (b) => b.cls("opacity-50 cursor-not-allowed"),
  );
```

**Value form** — switches on a prop key:

```ts
pose
  .as("div")
  .input(z.object({ variant: z.enum(["success", "error", "info"]) }))
  .when("variant", {
    success: (b) => b.cls("bg-green-100").child("✓ Done"),
    error: (b) => b.cls("bg-red-100").child("✗ Failed"),
    info: (b) => b.cls("bg-blue-100").child("ℹ Info"),
  });
```

When used with `createPose()`, static class names from all `.when()` branches are eagerly registered in the class registry, so `getAllClasses()` captures them even if those branches are never rendered at build time.

---

##### `.getClasses(props?)`

Returns the resolved class string for the element without rendering a full HTML string. Useful for testing or integrating with external class inspection tools.

```ts
const el = pose
  .as("div")
  .cls("rounded")
  .input(z.object({ active: z.boolean().default(false) }))
  .cls(({ active }) => (active ? "ring-2" : ""));

el.getClasses({ active: true }); // → "rounded ring-2"
el.getClasses({ active: false }); // → "rounded"
```

---

##### `.handler(fn)`

Closes the builder into a mountable `Component`. The handler receives a `HandlerContext` object:

```ts
interface HandlerContext<TProps, TEvents> {
  input: TProps; // schema-validated props for the initial render
  el: Element; // the root DOM element
  events: TEvents; // the event map instance
  render: (props?: Partial<TProps>) => void; // re-render without remounting events
}
```

```ts
const counter = pose
  .as("div")
  .input(z.object({ count: z.number().default(0) }))
  .child(({ count }) => `Count: ${count}`)
  .handler(({ events, render }) => {
    let n = 0;
    events.target<HTMLButtonElement>("button").on("click", () => {
      render({ count: ++n });
    });
  });

const cleanup = counter.mount(document.querySelector("#app"), createEventMap());
// cleanup() removes all listeners
```

`Component` retains the call signature of the underlying `PoseElement`, so it can be nested as a child inside other elements or ` html` ``templates without being independently mounted. A single`.mount()` call on the outermost parent activates all handlers for the entire tree.

`render()` swaps `el.innerHTML` and re-runs schema validation without calling `events.mount()` again — event listeners bound to CSS selectors (as `@poseui/on` does) automatically apply to the newly rendered children.

**Async schemas are not supported in `.mount()`.** Resolve async schemas before calling mount.

---

#### ` html` `` Tagged Template

The `html` tagged template literal composes `PoseElement`s and raw values into larger HTML structures while threading props through the entire tree.

```ts
import { html, slot } from "poseui";

type Props = { username: string; loggedIn: boolean };

const greeting = pose
  .as("p")
  .input(z.object({ username: z.string(), loggedIn: z.boolean() }))
  .cls(({ loggedIn }) => (loggedIn ? "text-green-600" : "text-gray-400"))
  .child(({ username, loggedIn }) => (loggedIn ? `Welcome back, ${username}` : "Please log in"));

const page = html<Props>`
  <div class="container">${greeting} ${({ loggedIn }) => (loggedIn ? "<span>✓</span>" : "")}</div>
`;

page({ username: "Ada", loggedIn: true });
// → <div class="container"><p class="text-green-600">Welcome back, Ada</p><span>✓</span></div>
```

Template slots accept:

- A `PoseElement` — rendered with the template's current props
- A function `(props) => string | null | undefined` — called with current props
- A static string, number, `null`, or `undefined`

**Opening-tag position spread** — when a `PoseElement` appears between a tag name and `>`, its class string and attributes are merged into the host tag rather than rendering as a child element:

```ts
const card = pose.as("div").cls("card rounded shadow");
const input = pose.as("input").cls("form-input").attr("type", "email").attr("required", "");

const loginForm = html`
  <div ${card}>
    <input ${input} name="email" />
  </div>
`;
// → <div class="card rounded shadow"><input class="form-input" type="email" required name="email" /></div>
```

**Nesting templates** — use `slot()` to compose one compiled template inside another with props threaded through:

```ts
const inner = html<{ name: string }>`<b>${({ name }) => name}</b>`;
const outer = html<{ name: string }>`<p>Hello, ${slot(inner)}!</p>`;

outer({ name: "Ada" }); // → <p>Hello, <b>Ada</b>!</p>
```

---

#### Presets

Presets extend every `PoseElement` produced by a `createPose()` instance with additional methods. A preset implements the `Preset` interface:

```ts
interface Preset<TElement> {
  name: string;
  extend(
    element: TElement,
    helpers: {
      cls(name: string): TElement;
      dynCls<T>(raw: Dyn<TProps, T>, map: (v: T) => string): TElement;
    },
  ): void;
}
```

Two presets are provided out of the box.

---

##### `tailwind4` Preset

Adds fluent methods for every Tailwind v4 utility class. Methods use underscores where Tailwind uses hyphens, since hyphens are not valid in JavaScript identifiers.

```ts
import { createPose } from "poseui";
import { tailwind4 } from "poseui/presets/tailwind4";

const pose = createPose({ presets: [tailwind4] });

const card = pose.as("div").flex().flex_col().gap(4).p(6).rounded("xl").shadow_md().bg("white");
```

Methods fall into four categories based on how they generate class names:

- **Static** — zero-argument methods that emit a fixed class: `.flex()` → `"flex"`, `.hidden()` → `"hidden"`
- **Prefix** — single-argument methods that append a value: `.px(4)` → `"px-4"`, `.grid_cols(3)` → `"grid-cols-3"`
- **Raw** — single-argument methods where the argument is used directly as the suffix: `.bg("indigo-600")` → `"bg-indigo-600"`
- **Optional** — zero or one argument: `.rounded()` → `"rounded"`, `.rounded("xl")` → `"rounded-xl"`

All argument-accepting methods also accept a dynamic function `(props) => value`, enabling prop-driven utility classes:

```ts
pose
  .as("div")
  .input(z.object({ cols: z.number() }))
  .grid()
  .grid_cols(({ cols }) => cols);
```

---

##### `basecoat` Preset

A typed adapter over [basecoat.css](https://basecoatcss.com), a CSS component library. Each method maps directly to basecoat class names and handles the class derivation logic internally.

```ts
import { basecoat } from "poseui/presets/basecoat";

const pose = createPose({ presets: [tailwind4, basecoat] });
```

Available component methods:

| Method              | Element    | Description                                                                     |
| ------------------- | ---------- | ------------------------------------------------------------------------------- |
| `.btn()`            | `button`   | Maps to `.btn`, `.btn-{size}`, `.btn-{variant}`, `.btn-{size}-{variant}`        |
| `.badge()`          | `span`     | Maps to `.badge`, `.badge-{variant}`                                            |
| `.alert()`          | `div`      | Maps to `.alert`, `.alert-destructive`; renders title and body automatically    |
| `.card()`           | `div`      | Maps to `.card`; renders `<header>`, `<section>`, `<footer>` from props         |
| `.input_field()`    | `input`    | Applies `.input` class with all state attributes                                |
| `.textarea_field()` | `textarea` | Applies `.textarea` class with state attributes                                 |
| `.label_field()`    | `label`    | Applies `.label` class and `for` attribute                                      |
| `.kbd()`            | `kbd`      | Applies `.kbd` class                                                            |
| `.data_table()`     | `table`    | Applies `.table` class; renders `thead`, `tbody`, `tfoot`, `caption` from props |
| `.tabs_group()`     | `div`      | Applies `.tabs` class; renders `[role=tablist]` and `[role=tabpanel]` elements  |
| `.tooltip()`        | any        | Applies `data-tooltip`, `data-side`, `data-align` attributes (CSS-only tooltip) |

Each method call resets `.input()` to the component's own schema, so props are fully typed:

```ts
const button = pose.as("button").btn();
button({ variant: "secondary", size: "lg", child: "Save" });
// → <button class="btn-lg-secondary">Save</button>

button({ variant: "destructive", size: "icon", disabled: true, child: "✕" });
// → <button class="btn-icon-destructive" disabled>✕</button>
```

---

#### UnoCSS Extractor

`poseui/unocss` provides a UnoCSS extractor that statically analyses source files for poseui method call chains and emits the Tailwind class names they would produce at runtime — without executing the code.

```ts
// uno.config.ts
import { extractorPoseui } from "poseui/unocss";

export default defineConfig({
  extractors: [extractorPoseui()],
});
```

The extractor handles:

- Zero-argument methods: `.flex()` → `"flex"`
- Single-argument methods with string literals: `.bg("indigo-600")` → `"bg-indigo-600"`
- Single-argument methods with numbers: `.px(4)` → `"px-4"`
- `.cls()` calls with space-separated literal strings: `.cls("ring-2 mt-4")` → `"ring-2"`, `"mt-4"`

Dynamic arguments (arrow functions, variable references) are skipped since their values are unknowable at static analysis time. For dynamic classes, `pose.getAllClasses()` should be used as a complementary mechanism.

---

#### Attribute Type Safety

All attribute names and values are type-checked against a comprehensive HTML attribute map. The tag name `TTag` is carried through the entire builder chain, so `.attr()` and `.attrs()` reject invalid attributes at compile time:

```ts
pose.as("input").attr("type", "email"); // ✓ valid
pose.as("input").attr("type", "emal"); // ✗ TypeScript error — invalid type value
pose.as("button").attr("href", "/home"); // ✗ TypeScript error — href not valid on button
pose.as("a").attr("href", "/home"); // ✓ valid
```

`data-*` and `aria-*` attributes are always accepted on any element with `string` values. The full ARIA attribute map with typed value unions is included in the attribute definitions.

IDL normalisation is applied throughout — attribute names use their HTML content attribute form, not their JavaScript property names: `for` not `htmlFor`, `readonly` not `readOnly`, `tabindex` not `tabIndex`, `colspan` not `colSpan`.

---

#### Class Registry and CSS Pipeline

When a `PoseElement` is created from a `createPose()` instance, every static class string passed to `.cls()` or accumulated through preset methods is registered in the instance's class registry. This enables a build-time CSS pipeline:

```ts
const pose = createPose({ presets: [tailwind4] });

// Define your components...
const card = pose.as("div").rounded("xl").shadow_md().p(6).bg("white");
const button = pose.as("button").btn();
// ...

// Extract all static classes for Tailwind/UnoCSS:
const allClasses = pose.getAllClasses();
// → "rounded-xl shadow-md p-6 bg-white ..."

// Write to a virtual file for Tailwind CLI content scanning:
fs.writeFileSync("poseui-classes.txt", allClasses);
```

Dynamic classes (those produced by functions over props) are not included in the registry, since their values are unknowable at build time. The UnoCSS extractor handles these through static analysis.

### @poseui/on

`@poseui/on` is a zero-dependency, framework-agnostic TypeScript library for typed DOM event registration. It provides a deferred, selector-based event binding model where listeners are registered before the DOM is queried, and all actual element lookup and attachment is deferred to an explicit `.mount()` call. Cleanup is handled by the unmount function returned from `.mount()`.

It integrates directly with `poseui`'s `.handler()` API as the `EventMap` implementation, but works equally well as a standalone utility against any DOM.

---

#### Overview

```ts
import { createEventMap } from "@poseui/on";

const events = createEventMap();

events.target<HTMLButtonElement>("#submit").on("click", (e) => {
  e.currentTarget.disabled = true; // e.currentTarget is HTMLButtonElement
});

events.target<HTMLInputElement>(".search").on("input", (e) => console.log(e.currentTarget.value));

events
  .targets<HTMLTableRowElement>("tbody tr")
  .on("mouseenter", (e) => e.currentTarget.classList.add("highlighted"));

const unmount = events.mount(document.querySelector("#app"));

// Later, on teardown or navigation:
unmount();
```

The key design properties are:

- **Deferred DOM access** — selectors are registered eagerly, but `querySelector`/`querySelectorAll` runs only when `.mount()` is called. Elements do not need to exist at registration time.
- **Scoped mounting** — `.mount(root)` only queries within the provided root element, preventing cross-component interference.
- **Precise cleanup** — the unmount function removes exactly the listeners that were attached during its corresponding `.mount()` call, without affecting other active mount instances.
- **Full type safety** — `e.currentTarget` is typed to the element type passed as the generic parameter, eliminating manual casts.

---

#### `createEventMap()`

```ts
function createEventMap(): EventMap;
```

Creates an isolated event registration instance. Each instance maintains its own internal registry — there is no global state or shared side effects between instances.

```ts
const eventsA = createEventMap();
const eventsB = createEventMap();
// eventsA and eventsB are completely independent
```

---

#### `EventMap`

The object returned by `createEventMap()`. Exposes three methods: `.target()`, `.targets()`, and `.mount()`.

---

##### `.target<T>(selector)`

```ts
target<T extends Element>(selector: string): TargetHandle<T>
```

Registers a single-element target by CSS selector. When `.mount()` is called, this resolves via `querySelector` — matching the first element in the mount root that satisfies the selector.

The type parameter `T` constrains `e.currentTarget` in all listeners registered on the returned handle. It defaults to `Element` if omitted.

```ts
events.target<HTMLButtonElement>("#submit").on("click", (e) => {
  // e.currentTarget: HTMLButtonElement
  e.currentTarget.disabled = true;
});
```

If the selector matches nothing at mount time, no listener is attached and no error is thrown.

---

##### `.targets<T>(selector)`

```ts
targets<T extends Element>(selector: string): TargetHandle<T>
```

Registers a multi-element target by CSS selector. When `.mount()` is called, this resolves via `querySelectorAll` — attaching the registered listeners to every matching element within the mount root.

```ts
events.targets<HTMLLIElement>(".item").on("click", (e) => {
  // e.currentTarget is the specific <li> that was clicked
  e.currentTarget.classList.toggle("selected");
});
```

Each matched element receives its own independent listener attachment. `e.currentTarget` inside the handler refers to the individual element that triggered the event, not the selector or the collection.

If the selector matches nothing, no listeners are attached and no error is thrown.

---

##### `.mount(root?)`

```ts
mount(root?: Element | Document): () => void
```

Queries all registered selectors within `root`, attaches every accumulated listener, and returns a cleanup function that removes them all.

`root` defaults to `document` if not provided, making all selectors global. Passing a specific element scopes all queries to that subtree, preventing matches against elements outside the component boundary.

```ts
const unmount = events.mount(document.querySelector("#app"));
```

`.mount()` can be called multiple times on the same `EventMap` instance — for example when a component is re-used in multiple subtrees. Each call returns an independent cleanup function that only removes the listeners attached during that specific call.

```ts
const unmountA = events.mount(rootA);
const unmountB = events.mount(rootB);

unmountA(); // removes listeners in rootA only — rootB unaffected
```

DOM querying is deferred entirely to this point. Registering a target for a selector that does not yet exist in the DOM is safe — as long as the element exists by the time `.mount()` is called, it will be found.

```ts
// Register before the element exists
events.target<HTMLButtonElement>("#late-btn").on("click", handler);

// Create the element
const root = document.createElement("div");
root.innerHTML = `<button id="late-btn">Click</button>`;

// Mount after — #late-btn is found correctly
events.mount(root);
```

---

#### `TargetHandle<T>`

The object returned by `.target()` and `.targets()`. Accumulates event listener registrations before mount. Both methods are chainable.

---

##### `.on(type, listener)`

```ts
on<K extends keyof EventMapFor<T>>(type: K, listener: ListenerFn<T, K>): TargetHandle<T>
```

Registers an event listener on this target. `type` is constrained to valid event names for the element type `T`: `HTMLElementEventMap` keys for `HTMLElement` subtypes, `SVGElementEventMap` keys for `SVGElement` subtypes, and `ElementEventMap` keys otherwise.

The listener receives a typed event object where `currentTarget` is narrowed to `T`:

```ts
events
  .target<HTMLInputElement>("#email")
  .on("input", (e) => {
    // e: InputEvent & { currentTarget: HTMLInputElement }
    console.log(e.currentTarget.value);
  })
  .on("blur", (e) => {
    e.currentTarget.classList.add("touched");
  });
```

Multiple `.on()` calls on the same handle accumulate — all registered listeners fire when the event occurs:

```ts
events
  .target<HTMLButtonElement>("#btn")
  .on("click", logClick)
  .on("click", trackAnalytics)
  .on("mouseenter", showTooltip);
```

---

##### `.off(type, listener)`

```ts
off<K extends keyof EventMapFor<T>>(type: K, listener: ListenerFn<T, K>): TargetHandle<T>
```

Removes a previously registered listener before `.mount()` is called. The listener reference must be the same function reference that was passed to `.on()`.

```ts
const handle = events.target<HTMLButtonElement>("#btn");
handle.on("click", handler);
handle.off("click", handler); // handler will not be attached at mount time
```

Calling `.off()` for a listener that was never registered does nothing and does not throw. Removing one listener leaves others on the same target unaffected:

```ts
handle.on("click", handlerA);
handle.on("click", handlerB);
handle.off("click", handlerA);
// Only handlerB will be attached at mount time
```

---

#### Cleanup — `unmount()`

The function returned from `.mount()` removes every listener that was attached during that specific mount call. It is safe to call multiple times — subsequent calls are no-ops:

```ts
const unmount = events.mount(root);

unmount(); // removes all listeners
unmount(); // no-op, no error
```

Cleanup is precise and scoped to the mount instance. Calling `unmount()` does not affect listeners attached by other `.mount()` calls on the same `EventMap`, or listeners managed by any other `EventMap` instance:

```ts
const events = createEventMap();
events.target<HTMLButtonElement>(".btn").on("click", handler);

const unmountA = events.mount(rootA);
const unmountB = events.mount(rootB);

unmountA(); // only rootA listeners removed
// rootB listeners remain active
```

---

#### Behaviour Notes

**Selector scoping.** Listeners are only attached to elements found within the mount root. An element with the same selector outside the root is never matched:

```ts
// <button class="btn"> exists both inside and outside root
events.target<HTMLButtonElement>(".btn").on("click", handler);
events.mount(root); // only the button inside root receives the listener
```

**SVG support.** The generic type parameter accepts any `Element` subtype, including SVG elements. Event types are narrowed accordingly to `SVGElementEventMap`:

```ts
events.target<SVGCircleElement>("#dot").on("click", handler);
```

**Identical listener deduplication.** The native `addEventListener` specification silently ignores duplicate registrations of the same `(element, type, listener)` triple. Registering the same function reference twice via `.on()` results in only one active listener:

```ts
handle.on("click", handler).on("click", handler);
// addEventListener deduplicates — handler fires once per click
```

**No re-querying on re-render.** When used with `poseui`'s `.handler()` and `render()`, `events.mount()` is called once at initial mount. Subsequent `render()` calls swap `innerHTML` without calling `events.mount()` again. Because listeners are bound to CSS selectors rather than specific element node references, they automatically apply to the new children written by `render()`.

### @poseui/form

`@poseui/form` is a zero-dependency TypeScript library for typed form binding via [Standard Schema v1](https://standardschema.dev). It wires a schema (Zod, Valibot, ArkType, or any compatible library) to an HTML form element, handling validation, per-field error state, dirty tracking, and programmatic submission. Event registration and teardown are managed via `@poseui/on`.

The library is fully synchronous and never throws on validation failures — errors are always returned as structured data.

---

#### Overview

```ts
import { createForm } from "@poseui/form";
import { z } from "zod";

const form = createForm({
  target: "#signup",
  schema: z.object({
    email: z.string().email(),
    name: z.string().min(1),
    age: z.coerce.number().min(18),
  }),
  onSubmit(values) {
    // values is fully typed: { email: string; name: string; age: number }
    console.log(values.email, values.name, values.age);
  },
  onError(issues) {
    // issues: ReadonlyArray<StandardSchemaV1.Issue>
    console.log(issues);
  },
  validateOn: "change",
});

const unmount = form.mount();

// Read current field values at any time:
const result = form.values();
if (result.ok) console.log(result.data.email);

// Tear down when done:
unmount(); // equivalent to form.unmount()
```

---

#### `createForm(options)`

```ts
function createForm<S extends StandardSchemaV1>(options: CreateFormOptions<S>): Form<S>;
```

Creates a form binding instance. The form is not activated until `.mount()` is called — `createForm()` itself touches no DOM.

---

##### Options

**`target`** — `string | HTMLFormElement`

The form to bind to. Accepts a CSS selector string or a direct `HTMLFormElement` reference.

```ts
target: "#signup";
target: document.querySelector<HTMLFormElement>("#signup")!;
```

If a selector string is provided, the element is looked up at `.mount()` time, not at `createForm()` time. If no element is found when `.mount()` is called, an error is thrown.

---

**`schema`** — `StandardSchemaV1`

Any Standard Schema v1-compatible validator. Form field values are read via `FormData` and passed to the schema's `validate` function. Schema defaults and transforms are applied before `onSubmit` is called.

```ts
schema: z.object({
  code: z.string().trim().toUpperCase(),
  age: z.coerce.number().min(0),
});
// Field value "  abc  " reaches onSubmit as "ABC"
// Field value "25" (string) reaches onSubmit as 25 (number)
```

Async schemas are not supported. If the schema's `validate` function returns a `Promise`, validation is treated as a failure and a warning is logged to the console.

---

**`onSubmit`** — `(values: InferOutput<S>, event: SubmitEvent) => void`

Called with fully typed, schema-validated output values after a successful submission. Not called if validation fails.

---

**`onError`** — `(issues: ReadonlyArray<StandardSchemaV1.Issue>, event: SubmitEvent) => void` _(optional)_

Called with the structured issue list when validation fails on submission. If omitted, failed submissions are silently ignored (other than updating `.errors()`).

---

**`validateOn`** — `"submit" | "change" | "input"` _(default: `"submit"`)_

Controls when schema validation runs automatically in response to field changes:

- `"submit"` — validation runs only when the form is submitted. Errors do not appear until the user attempts to submit.
- `"change"` — validation runs on `change` events, which fire when a field loses focus with a changed value. Errors appear field-by-field as the user moves between fields.
- `"input"` — validation runs on every `input` event, updating errors on every keystroke.

Dirty tracking (`.isDirty()`) is always active via `change` events regardless of this setting.

---

**`root`** — `Element | Document` _(optional)_

Scopes all event registration to a specific subtree. Passed directly to `@poseui/on`'s `.mount()`. Defaults to `document`. Use this to prevent the form binding from matching elements outside a specific component boundary.

```ts
root: document.querySelector("#app")!;
```

---

#### `Form<S>`

The object returned by `createForm()`. All methods are safe to call before `.mount()` where noted.

---

##### `.values()`

```ts
values(): FormResult<InferOutput<S>>
```

Reads the current form field values and runs them through the schema synchronously. Returns a discriminated union — never throws.

```ts
type FormResult<T> =
  | { ok: true; data: T }
  | { ok: false; issues: ReadonlyArray<StandardSchemaV1.Issue> };
```

```ts
const result = form.values();
if (result.ok) {
  console.log(result.data.email); // typed
} else {
  console.log(result.issues); // StandardSchemaV1.Issue[]
}
```

Can be called at any time — before mount, between events, or in response to external signals — making it suitable for driving derived UI state reactively without waiting for a submission.

---

##### `.errors()`

```ts
errors(): FormErrors
// FormErrors = Record<string, string[]>
```

Returns the per-field error state from the most recent validation attempt. Keys are dot-separated field paths (e.g. `"user.email"` for a nested schema), and values are arrays of error message strings so multiple failing rules on a single field are all surfaced.

```ts
form.errors();
// → { "email": ["Invalid email"], "age": ["Must be at least 18"] }
```

Returns an empty object before any validation has run. Errors are cleared automatically after a successful submission.

The returned object is a shallow copy — mutating it does not affect the form's internal error state.

---

##### `.isDirty()`

```ts
isDirty(): boolean
```

Returns `true` if any field value has changed since `.mount()` was called. Dirty state is tracked via `change` events on all `input`, `select`, and `textarea` elements within the form, regardless of the `validateOn` setting.

```ts
form.isDirty(); // → false (before any interaction)

// User edits a field and moves focus away:
form.isDirty(); // → true
```

---

##### `.submit()`

```ts
submit(): void
```

Programmatically triggers the validate → `onSubmit` / `onError` cycle without requiring a user gesture. Useful for submit buttons outside the `<form>` element, or for testing.

When the form is mounted, `submit()` dispatches a `SubmitEvent` on the form element so any other listeners registered on it also fire. When called before mount, it runs the validation cycle directly.

```ts
form.mount();
form.submit(); // dispatches submit event → triggers onSubmit or onError
```

---

##### `.mount()`

```ts
mount(): () => void
```

Attaches event listeners to the form and activates the binding. Returns a cleanup function equivalent to calling `form.unmount()`.

Throws if the target element cannot be found in the DOM at mount time.

```ts
const unmount = form.mount();
// later:
unmount();
```

Safe to call multiple times — each call produces an independent cleanup. The cleanup function from each call removes only the listeners attached during that specific mount.

---

##### `.unmount()`

```ts
unmount(): void
```

Removes all event listeners attached by the most recent `.mount()` call. Idempotent — safe to call multiple times without throwing.

```ts
form.unmount();
form.unmount(); // no-op
```

---

#### FormData Extraction

Field values are read using the browser's native `FormData` API. The extraction logic applies one rule for multi-value fields:

- **Single value** — the field value is unwrapped from the `FormData` array so schema definitions can use `z.string()` rather than `z.array(z.string())`.
- **Multiple values** — fields with the same `name` (multi-select, same-name checkboxes) are kept as an array.

```ts
// Single field: <input name="email" value="ada@example.com" />
// → { email: "ada@example.com" }

// Multi-value: two <input name="tags"> elements
// → { tags: ["typescript", "zod"] }
```

All values read from `FormData` are strings. Use schema coercions for numeric or boolean fields:

```ts
schema: z.object({
  age: z.coerce.number().min(0),
  enabled: z.coerce.boolean(),
});
```

---

#### Error Shape

Validation issues are converted to a flat `FormErrors` map before being stored and returned from `.errors()`. Issue paths are serialised to dot-separated strings:

```ts
// Schema with nested object:
z.object({ user: z.object({ email: z.string().email() }) });

// Resulting error map after failed validation:
form.errors();
// → { "user.email": ["Invalid email"] }
```

The raw `StandardSchemaV1.Issue[]` array is passed directly to `onError` for cases where the full issue structure (including path segments) is needed.

---

#### Multiple Forms on the Same Page

Each `createForm()` call produces an independent instance with its own internal state and event registration. Multiple forms can be mounted simultaneously without interfering with each other:

```ts
const formA = createForm({ target: "#form-a", schema: schemaA, onSubmit: handleA });
const formB = createForm({ target: "#form-b", schema: schemaB, onSubmit: handleB });

formA.mount();
formB.mount();

// Submitting form-a only triggers handleA
// Submitting form-b only triggers handleB

formA.unmount();
formB.unmount();
```

---

#### Behaviour Notes

**Async schemas are not supported.** `@poseui/form` is fully synchronous. If the schema's `validate` function returns a `Promise`, the result is treated as a failure and a warning is logged. With Zod, this means avoiding async `.refine()` callbacks.

**`event.preventDefault()` is always called.** The submit event listener always calls `preventDefault()`, preventing the native browser form submission regardless of whether validation passes or fails.

**Forms without an `id`.** When an `HTMLFormElement` reference is passed as `target` and the element has no `id` attribute, a temporary `data-poseui-form` attribute is set on the element to construct a CSS selector for `@poseui/on`. This attribute is removed when `.unmount()` is called.

**`textarea` and `select` are fully supported.** All three standard field element types (`input`, `select`, `textarea`) are included in both dirty tracking and live validation listeners. `textarea` content and `select` values are read correctly via `FormData`.

**Root scoping prevents cross-component interference.** Passing a `root` element confines all `querySelector`/`querySelectorAll` calls to that subtree, so forms nested inside a bounded component container cannot accidentally match or be affected by forms elsewhere in the document.

### @poseui/store

`@poseui/store` is a reactive state management library backed by [alien-signals](https://github.com/stackblitz/alien-signals). Its API mirrors zustand/vanilla — `getState`, `setState`, `subscribe`, and `getInitialState` — making it immediately familiar to anyone coming from that ecosystem. One addition, `bind()`, closes the loop between state changes and DOM renders by connecting a store slice directly to an element's `innerHTML` via a render function.

---

#### Overview

```ts
import { createStore } from "@poseui/store";

const store = createStore(
  {
    count: 0,
    user: null as { name: string } | null,
  },
  (set, get, getInitialState) => ({
    inc: () => set((s) => ({ count: s.count + 1 })),
    login: (user: { name: string }) => set({ user }),
    reset: () => set(getInitialState()),
  }),
);

// Subscribe to a slice — listener fires only when count changes
store.subscribe(
  (s) => s.count,
  (count, prev) => console.log("count:", count, "was:", prev),
);

// Bind a DOM element — re-renders only when count changes
store.bind(
  document.getElementById("counter")!,
  (s) => s.count,
  (count) => counterEl({ count }),
);

store.getState().inc();
```

---

#### `createStore(initialState, actions?)`

```ts
// State only — no actions
function createStore<TState extends object>(initialState: TState): StoreApi<TState>;

// State + actions — both types inferred automatically
function createStore<TState extends object, TActions extends object>(
  initialState: TState,
  actions: (
    set: SetState<TState>,
    get: GetState<TState & TActions>,
    getInitialState: () => TState,
  ) => TActions,
): StoreApi<TState & TActions>;
```

Creates a reactive store. Pass initial state as a plain object as the first argument. Optionally pass an actions creator as the second argument — it receives `set`, `get`, and `getInitialState`, and returns only the action functions.

**TypeScript infers everything — no type annotations or explicit generics are needed:**

```ts
// State only — T inferred from the object literal
const store = createStore({ count: 0, name: "Ada" });

// State + actions — both inferred, no annotation needed
const store = createStore({ count: 0 }, (set, _get, getInitialState) => ({
  inc: () => set((s) => ({ count: s.count + 1 })),
  reset: () => set(getInitialState()),
}));

store.getState().count; // number  ✓
store.getState().inc; // () => void  ✓
```

The actions creator receives three arguments:

- **`set(update)`** — merges a partial update into state (see [`.setState()`](#setstate))
- **`get()`** — returns the current state snapshot synchronously, typed as `TState & TActions` so actions can call each other
- **`getInitialState()`** — returns the original initial state frozen at construction time; the only thing `get()` cannot provide

```ts
const store = createStore({ count: 0 }, (set, get, getInitialState) => ({
  inc: () => set((s) => ({ count: s.count + 1 })),
  // inter-action call via get():
  incThenDouble: () => {
    get().inc();
    set((s) => ({ count: s.count * 2 }));
  },
  // reset via getInitialState():
  reset: () => set(getInitialState()),
}));

store.setState({ count: 99 });
store.getState().reset();
store.getState().count; // → 0
```

---

#### `StoreApi<T>`

The object returned by `createStore()`. Exposes five methods.

---

##### `.getState()`

```ts
getState(): T
```

Returns the current state snapshot synchronously. The same reference is returned on consecutive calls when the state has not changed.

```ts
store.getState().count; // → 0
store.setState({ count: 5 });
store.getState().count; // → 5
```

---

##### `.getInitialState()`

```ts
getInitialState(): TState
```

Returns the initial state object passed as the first argument to `createStore()`. Never updated by `setState`. Useful as a reset reference:

```ts
store.setState(store.getInitialState()); // reset externally
```

Or from within an action via the `getInitialState` argument:

```ts
const store = createStore({ count: 5 }, (set, _get, getInitialState) => ({
  reset: () => set(getInitialState()),
}));

store.setState({ count: 99 });
store.getState().reset();
store.getState().count; // → 5
```

Note: `getInitialState()` returns the plain state shape only — it does not include action functions.

---

##### `.setState(update)`

```ts
setState(update: Partial<T> | ((state: T) => Partial<T>)): void
```

Merges a partial update shallowly into the current state. Accepts either a plain object or an updater function that receives the current state and returns a partial.

```ts
store.setState({ count: 5 });
store.setState((s) => ({ count: s.count + 1 }));
```

Only the keys present in the update are changed — all other keys (including action functions) are preserved:

```ts
const store = createStore({ a: 1, b: 2, c: 3 });
store.setState({ c: 99 });
store.getState(); // → { a: 1, b: 2, c: 99 }
```

---

##### `.subscribe(listener)` and `.subscribe(selector, listener)`

Two overloads for reacting to state changes.

**Full-state form** — fires on every `setState` call:

```ts
subscribe(listener: (state: T, prevState: T) => void): () => void
```

```ts
const unsub = store.subscribe((state, prev) => {
  console.log("count changed from", prev.count, "to", state.count);
});

// Stop listening:
unsub();
```

**Selector form** — fires only when the selected slice changes by reference:

```ts
subscribe<S>(selector: (state: T) => S, listener: (slice: S, prevSlice: S) => void): () => void
```

```ts
const unsub = store.subscribe(
  (s) => s.count,
  (count, prev) => console.log("count:", count, "was:", prev),
);
```

The selector form uses `alien-signals`' `computed` internally — the listener is skipped entirely when a `setState` changes other keys but leaves the selected value at the same reference:

```ts
const store = createStore({ count: 0, name: "Ada" });
store.subscribe((s) => s.count, listener);

store.setState({ name: "Grace" }); // listener not called — count unchanged
store.setState({ count: 1 }); // listener called
```

Both forms:

- Do **not** fire immediately on subscription — the listener is called only on subsequent state changes
- Return an unsubscribe function; calling it stops further notifications
- Are idempotent when the returned unsubscribe is called multiple times

Multiple independent subscriptions can coexist on the same store. Unsubscribing one does not affect others.

---

##### `.bind(el, render)` and `.bind(el, selector, render)`

Connects a DOM element's `innerHTML` to store state via a render function. Renders immediately on call, then re-renders automatically whenever the relevant state changes. Returns an unsubscribe / cleanup function.

**Full-state form** — re-renders on any state change:

```ts
bind(el: Element, render: (state: T) => string): () => void
```

```ts
const unsub = store.bind(document.getElementById("counter")!, (state) =>
  counterEl({ count: state.count }),
);
```

**Selector form** — re-renders only when the selected slice changes by reference:

```ts
bind<S>(el: Element, selector: (state: T) => S, render: (slice: S) => string): () => void
```

```ts
const unsub = store.bind(
  document.getElementById("user")!,
  (s) => s.user,
  (user) => userEl({ name: user?.name ?? "Guest" }),
);
```

The selector form is the preferred approach when the store holds multiple independent slices. It avoids unnecessary re-renders when unrelated parts of state change:

```ts
const store = createStore({ count: 0, name: "Ada" });

store.bind(
  document.getElementById("count-display")!,
  (s) => s.count,
  (count) => `<span>${count}</span>`,
);

store.setState({ name: "Grace" }); // count-display does not re-render
store.setState({ count: 1 }); // count-display re-renders
```

The cleanup function stops all re-renders for that binding:

```ts
const unsub = store.bind(
  el,
  (s) => s.count,
  (c) => `${c}`,
);
store.setState({ count: 1 }); // el updates to "1"
unsub();
store.setState({ count: 99 }); // el stays at "1"
```

---

#### `effectScope`

Re-exported from `alien-signals`. Groups multiple subscriptions and bindings so they can all be torn down with a single `stop()` call. Useful for component-level cleanup where many bindings need to be removed together.

```ts
import { createStore, effectScope } from "@poseui/store";

const stop = effectScope(() => {
  store.bind(
    document.getElementById("count")!,
    (s) => s.count,
    (count) => `Count: ${count}`,
  );
  store.bind(
    document.getElementById("name")!,
    (s) => s.name,
    (name) => name,
  );
  store.subscribe((state, prev) => {
    if (state.count !== prev.count) analytics.track("count_changed");
  });
});

// Later — tears down all three at once:
stop();
```

---

#### Patterns

##### Actions in the creator

Actions are plain functions returned by the actions creator. They call `set` to update state, `get` to read it (including other actions), and `getInitialState` for reset patterns:

```ts
const store = createStore({ count: 0 }, (set, get, getInitialState) => ({
  inc: () => set((s) => ({ count: s.count + 1 })),
  dec: () => set((s) => ({ count: s.count - 1 })),
  incThenDouble: () => {
    get().inc();
    set((s) => ({ count: s.count * 2 }));
  },
  reset: () => set(getInitialState()),
}));

store.getState().inc();
store.getState().inc();
store.getState().dec();
store.getState().count; // → 1
```

Actions are preserved across `setState` calls — `setState({ count: 5 })` only changes `count`, leaving all action functions intact.

##### Driving form error state

```ts
const store = createStore({ errors: {} as Record<string, string> }, (set) => ({
  setErrors: (errors: Record<string, string>) => set({ errors }),
  clearErrors: () => set({ errors: {} }),
}));

store.bind(
  document.getElementById("error-list")!,
  (s) => s.errors,
  (errors) =>
    Object.entries(errors)
      .map(([field, msg]) => `<p data-field="${field}">${msg}</p>`)
      .join(""),
);

// On form validation failure:
store.getState().setErrors({ email: "Invalid email", name: "Required" });

// On successful submission:
store.getState().clearErrors();
```

##### Combining with `@poseui/form`

`@poseui/store` pairs naturally with `@poseui/form` — the form drives validation and extracts typed values, while the store holds application state that changes in response. The store's `.subscribe()` (selector form) or `.bind()` then updates the DOM reactively:

```ts
const appStore = createStore({ user: null as { name: string } | null }, (set) => ({
  login: (user: { name: string }) => set({ user }),
}));

const loginForm = createForm({
  target: "#login",
  schema: loginSchema,
  onSubmit: (values) => appStore.getState().login(values),
});

appStore.bind(
  document.getElementById("nav")!,
  (s) => s.user,
  (user) => navEl({ loggedIn: user !== null, name: user?.name }),
);

loginForm.mount();
```

---

#### Behaviour Notes

**Reactive engine.** `@poseui/store` is backed by alien-signals' fine-grained reactivity. `computed` is used internally to derive selector slices, so the dependency graph is tracked automatically — only effects that depend on a changed signal re-run.

**Shallow merge, not deep merge.** `setState` performs a one-level `{ ...current, ...patch }` merge. Nested objects must be replaced entirely when changed:

```ts
// ✗ Does not update nested.value — replaces only the top-level key
store.setState({ nested: { value: 99 } });

// ✓ Spread to preserve sibling keys
store.setState((s) => ({ nested: { ...s.nested, value: 99 } }));
```

**Slice comparison uses `Object.is`.** The selector form of both `.subscribe()` and `.bind()` compares slices by reference using `Object.is`. Primitive values (numbers, strings, booleans) are compared by value. Object and array slices are compared by identity — a new object reference, even with identical contents, is treated as a changed value.

**Subscriptions do not fire immediately.** Neither form of `.subscribe()` calls the listener at registration time. Both fire only on subsequent state changes. `.bind()` does render immediately on call, since the element needs to display initial state.

**Multiple binds on the same element.** Binding two separate store slices to the same element results in both effects writing `el.innerHTML` independently. Whichever effect runs last on any given state change wins. Prefer a single `bind` with a render function that reads all required data, or use two separate elements.

### @poseui/match

`@poseui/match` is a zero-dependency, framework-agnostic TypeScript utility for typed pattern matching against plain objects. It is designed to compose class strings conditionally from props — and is used internally by `poseui`'s `.when()` builder method — but works equally well for any scenario where multiple conditions need to be evaluated against a single value to produce results.

---

#### Overview

The library exposes a single `match()` function that accepts a plain object and returns an immutable `MatchBuilder`. Matchers are registered by chaining `.when()` calls, and results are collected with one of four terminal methods: `.all()`, `.first()`, `.last()`, or `.resolve()`.

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

The default output type `TOut` is `string`, making class string composition require no type annotations. An explicit `TOut` type parameter can be provided when producing other value types.

---

#### `match(value)`

```ts
function match<TIn extends Record<string, unknown>>(value: TIn): MatchBuilder<TIn, string>;
function match<TIn extends Record<string, unknown>, TOut>(value: TIn): MatchBuilder<TIn, TOut>;
```

Creates a `MatchBuilder` against `value`. The builder is immutable — every `.when()` call returns a new builder instance without modifying the one it was called on.

```ts
const base = match({ x: 1 });
const withMatcher = base.when(({ x }) => x === 1, "hit");

base.all(); // → [] (original is unaffected)
withMatcher.all(); // → ["hit"]
```

---

#### `.when()` — Registering Matchers

There are two forms of `.when()`. Both are accumulative — all registered matchers are evaluated in registration order when a terminal method is called.

---

##### Predicate form

```ts
.when(pred: (value: TIn) => boolean, result: TOut | ((value: TIn) => TOut))
```

Matches when `pred` returns `true`. The result can be a static value or a function that receives the full input value.

```ts
match({ count: 7, active: true })
  .when(({ active }) => active, "ring-2")
  .when(
    ({ count }) => count > 5,
    ({ count }) => `badge-${count}`,
  )
  .all();
// → ["ring-2", "badge-7"]
```

---

##### Key switch form

```ts
.when(key: keyof TIn, cases: Partial<Record<TIn[K] & PropertyKey, TOut | ((value: TIn) => TOut)>>)
```

Switches on the value of a specific key. Cases are `Partial` — an unmatched value simply contributes nothing.

```ts
match({ variant: "primary" })
  .when("variant", {
    primary: "bg-indigo-600 text-white",
    secondary: "bg-slate-200 text-slate-900",
  })
  .first();
// → "bg-indigo-600 text-white"
```

Result functions in a key switch receive the full input value, not just the matched key's value:

```ts
match({ size: "lg", scale: 4 })
  .when("size", {
    sm: ({ scale }) => `gap-${scale / 2}`,
    lg: ({ scale }) => `gap-${scale * 2}`,
  })
  .first();
// → "gap-8"
```

---

##### Mixing both forms

Predicate and key switch matchers can be freely interleaved. They are always evaluated in the order they were registered:

```ts
match({ variant: "primary", disabled: true })
  .when("variant", { primary: "bg-indigo-600 text-white" })
  .when(({ disabled }) => disabled, "opacity-50 cursor-not-allowed")
  .all();
// → ["bg-indigo-600 text-white", "opacity-50 cursor-not-allowed"]
```

---

#### Terminal Methods

All terminal methods are non-destructive — they can be called multiple times on the same builder and always produce the same result.

---

##### `.all()`

Returns an array of every matched result, in registration order. Returns an empty array if nothing matched.

```ts
match({ a: true, b: true, c: false })
  .when(({ a }) => a, "A")
  .when(({ b }) => b, "B")
  .when(({ c }) => c, "C")
  .all();
// → ["A", "B"]
```

---

##### `.first()`

Returns the first matched result, or `undefined` if nothing matched.

```ts
match({ status: "error" }).when("status", { ok: "text-green-600", error: "text-red-600" }).first();
// → "text-red-600"
```

---

##### `.last()`

Returns the last matched result, or `undefined` if nothing matched.

```ts
match({ a: true, b: true })
  .when(({ a }) => a, "A")
  .when(({ b }) => b, "B")
  .last();
// → "B"
```

---

##### `.resolve()`

When `TOut` is `string` (the default), joins all matched results with a single space and returns a `string`. Returns an empty string if nothing matched.

When `TOut` is not `string`, behaves identically to `.all()` and returns `TOut[]`.

```ts
match({ variant: "primary", disabled: true })
  .when("variant", { primary: "bg-indigo-600 text-white" })
  .when(({ disabled }) => disabled, "opacity-50")
  .resolve();
// → "bg-indigo-600 text-white opacity-50"
```

`.resolve()` is the most ergonomic terminal for the primary use case of composing Tailwind or UnoCSS class strings from a props object.

---

#### Non-string Output Types

Pass an explicit `TOut` type parameter to `match()` when producing values other than strings:

```ts
const icon = match<typeof props, ReactNode>({ status: "error" })
  .when("status", {
    ok:      <CheckIcon />,
    error:   <XIcon />,
    pending: <SpinnerIcon />,
  })
  .first();
```

When `TOut` is not `string`, `.resolve()` returns `TOut[]` rather than a joined string.

---

#### Behaviour Notes

**Evaluation is lazy.** Matchers are not evaluated until a terminal method is called.

**Numeric keys work.** JavaScript coerces numeric object keys to strings in property lookups, and the key switch form accounts for this:

```ts
match({ level: 3 as number })
  .when("level", { 1: "text-sm", 2: "text-base", 3: "text-lg" })
  .first();
// → "text-lg"
```

**Boolean values require the predicate form.** Booleans are not valid `PropertyKey` types in TypeScript, so a boolean prop cannot be used as a key switch key:

```ts
// ✓ correct
match({ active: true })
  .when(({ active }) => active, "ring-2")
  .when(({ active }) => !active, "opacity-50")
  .first();
```

**Deeply nested values are accessible via result functions.** The predicate and result function always receive the full input object:

```ts
match({ user: { role: "admin" }, active: true })
  .when(({ user }) => user.role === "admin", "bg-red-100")
  .when(({ active }) => active, "ring-2")
  .resolve();
// → "bg-red-100 ring-2"
```
