# poseui

Type-safe HTML templating engine with a fluent utility-class builder API. Inspired by [gpui](https://www.gpui.rs/).

Zero dependencies. Fully synchronous. Emits HTML with utility class names.

```ts
import pose from "poseui";
import { z } from "zod";

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
    (b) => b.opacity(50).cursor_not_allowed().attr("disabled", "true"),
  )
  .child(({ variant }) => (variant === "primary" ? "Submit" : "Cancel"));

button({ variant: "primary" });
// → <button class="px-4 py-2 rounded font-semibold transition bg-indigo-600 text-white">Submit</button>

button({ variant: "secondary", disabled: true });
// → <button class="px-4 py-2 rounded font-semibold transition bg-slate-200 text-slate-900 opacity-50 cursor-not-allowed">Cancel</button>
```

## Install

```bash
bun add poseui
bun add zod  # or valibot, arktype, any Standard Schema lib
```

## CSS

Pose emits standard utility class names and works with UnoCSS via a first-party extractor. Install the dependencies:

```bash
bun add -d unocss
```

Then set up the three config files:

```ts
// uno.config.ts
import { extractorPoseui } from "poseui/unocss";
import { defineConfig, presetWind4, transformerDirectives, transformerVariantGroup } from "unocss";

export default defineConfig({
  presets: [
    presetWind4({
      dark: "class",
    }),
  ],
  theme: {}, // css vars
  extractors: [extractorPoseui()],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  outputToCssLayers: {
    cssLayerName: (layer) => {
      if (layer === "preflights") return "base";
      if (layer === "default") return "utilities";
      if (layer === "shortcuts") return "utilities.shortcuts";
      return layer;
    },
  },
  content: {
    pipeline: {
      include: ["src/**/*.ts", "node_modules/poseui/dist/presets/tailwind4/index.js"],
    },
  },
});
```

```ts
// vite.config.ts
import UnoCSS from "unocss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [UnoCSS()],
});
```

```ts
// main.ts
import "virtual:uno.css";
```

`extractorPoseui()` teaches UnoCSS how to extract utility classes from `PoseElement` instances and `html\`\`` templates directly from your source files — no separate safelist step needed.

## Core concepts

**`pose.as(tag)`** — start a builder for any HTML element tag.

**`.input(schema)`** — bind a [Standard Schema](https://standardschema.dev) object schema. Infers `TProps` from the output type so `.default()` transforms work. Validates on every call and throws `PoseValidationError` on failure.

**Style methods** — cover the full utility class surface: layout, spacing, typography, colour, borders, shadows, transforms, filters, animation, and more. Every method that takes a value also accepts `(props: TProps) => value` for dynamic styles. See the source for the complete list.

**`.when(pred, apply)`** — apply styles when a predicate returns true:

```ts
.when(({ disabled }) => disabled, (b) => b.opacity(50).cursor_not_allowed())
```

**`.when(key, cases)`** — switch on a prop key and apply styles per matching case. Case keys are typed to the prop's actual union — typos are compile errors:

```ts
.when("size", {
  sm: (b) => b.px(2).py(1).text_sm(),
  md: (b) => b.px(4).py(2).text_base(),
  lg: (b) => b.px(6).py(3).text_lg(),
})
```

Cases are `Partial` — unmatched values emit nothing. Multiple `.when()` calls stack independently and are all evaluated at render time.

**`.attr(name, value)`** — set a single HTML attribute. Value can be static or `(props) => string | null`. `null` omits the attribute entirely; `""` renders it as a boolean attribute (`required`, `disabled`, etc.):

```ts
pose
  .as("a")
  .input(z.object({ url: z.string(), external: z.boolean() }))
  .attr("href", ({ url }) => url)
  .attr("target", ({ external }) => (external ? "_blank" : null))
  .attr("rel", ({ external }) => (external ? "noopener noreferrer" : null));
```

**`.attrs(record | fn)`** — set multiple attributes at once. Accepts a record of static/dynamic values, or a `(props) => Record<string, string | null>` function for when attributes depend on each other:

```ts
// record form
pose.as("input").attrs({
  type: "text",
  name: ({ field }) => field,
  required: ({ required }) => (required ? "" : null),
});

// function form
pose.as("a").attrs(({ url, external }) => ({
  href: url,
  target: external ? "_blank" : null,
  rel: external ? "noopener noreferrer" : null,
}));
```

**`.cls(value)`** — escape hatch for anything not covered by the builder. Accepts a raw class string or `(props) => string`:

```ts
pose
  .as("div")
  .cls("hover:opacity-75")
  .cls(({ active }) => (active ? "ring-2 ring-blue-500" : ""));
```

**`.child(value | fn)`** — append children. Accepts a string, number, another `PoseElement`, an array of those, or `(props) => any of the above`. Chainable — call it multiple times to append in order.

**`.on(selector, type, handler)`** — register a delegated event listener scoped to a CSS selector. Stored on the builder and wired at mount time onto the stable root element, so listeners survive `render()` calls that swap `innerHTML`. The selector is matched via `.closest()`, so clicks on child nodes inside the target are handled correctly. Can be chained multiple times for multiple targets or event types. All registrations are cleaned up when the component is unmounted.

```ts
pose
  .as("div")
  .input(z.object({ count: z.number().default(0) }))
  .child(
    ({ count }) => `
    <span>${count}</span>
    <button id="inc">+</button>
    <button id="dec">-</button>
  `,
  )
  .on("#inc", "click", () => store.getState().increment())
  .on("#dec", "click", () => store.getState().decrement())
  .handler(({ render }) => {
    const unsub = store.subscribe(
      (s) => s.count,
      (count) => render({ count }),
    );
    return unsub; // called when the component is unmounted
  });
```

**`.getClasses(props?)`** — returns the resolved class string for the given props without rendering a full HTML element. Useful for testing, introspection, or feeding classes into other systems:

```ts
button.getClasses({ variant: "primary" });
// → "px-4 py-2 rounded font-semibold transition bg-indigo-600 text-white"

button.getClasses({ variant: "secondary", disabled: true });
// → "px-4 py-2 rounded font-semibold transition bg-slate-200 text-slate-900 opacity-50 cursor-not-allowed"
```

**`element(props)`** — render to an HTML string. Synchronous unless the bound schema uses async validation, in which case it returns `Promise<string>`.

**`.handler(fn)`** — close the builder into a mountable component. The result is callable like a regular element (returns an HTML string) and can be nested freely inside other elements or `html\`\`` templates. See [Components](#components).

## Composition

`PoseElement` and `Component` instances are valid children of other elements. Since `.handler()` returns a callable, components compose identically to plain elements:

```ts
const avatar = pose.as("img").rounded_full().w(8).h(8);

const card = pose
  .as("div")
  .p(4)
  .rounded()
  .shadow_md()
  .child(avatar)
  .child(pose.as("p").text_sm().child("Hello"));

card();
// → <div class="p-4 rounded shadow-md"><img class="rounded-full w-8 h-8"></img><p class="text-sm">Hello</p></div>
```

## Components

`.handler()` closes the builder into a mountable component. The result retains the element's call signature — it renders to an HTML string just like any `PoseElement` — and additionally exposes `.mount(el, events, props?)` which writes `innerHTML`, runs the handler to wire event listeners, and returns a cleanup function.

```ts
import { createPose } from "poseui";
import { createEventMap } from "@poseui/on";
import { z } from "zod";

const pose = createPose();

const counter = pose
  .as("div")
  .cls("flex items-center gap-4")
  .input(z.object({ count: z.number().default(0) }))
  .child(
    ({ count }) => `
    <span class="text-2xl font-bold">${count}</span>
    <button type="button">+</button>
  `,
  )
  .on("button", "click", () => store.getState().increment())
  .handler(({ render }) => {
    const unsub = store.subscribe(
      (s) => s.count,
      (count) => render({ count }),
    );
    return unsub; // called on unmount — unsubscribes from the store
  });

const unmount = counter.mount(document.querySelector("#app")!, createEventMap());

unmount(); // removes delegated listeners, events listeners, and calls the handler teardown
```

The handler receives a context object with four keys:

**`input`** — the schema-validated props for the initial render. Transforms and defaults are already applied.

**`el`** — the root `Element` passed to `.mount()`. Already has `innerHTML` set when the handler runs.

**`events`** — the event map passed to `.mount()`. Wire listeners here — they are scoped to `el` when `events.mount(el)` is called automatically after the handler returns. Pass a `createEventMap()` instance from [`@poseui/on`](../on).

**`render(props?)`** — re-render the component with new props. Swaps `el.innerHTML` without touching event listeners or subscriptions — delegated listeners registered via `.on()` are bound to the stable root element and survive re-renders automatically. Runs schema validation and defaults on every call.

```ts
.handler(({ input, el, events, render }) => {
  // input  — validated initial props
  // el     — the root DOM element, innerHTML already set
  // events — wire @poseui/on listeners here
  // render — swaps innerHTML only; .on() listeners and subscriptions stay alive

  const unsub = store.subscribe((s) => s.count, (count) => render({ count }));
  return unsub; // optional teardown — return a function to run on unmount
})
```

The handler may optionally return a teardown function. If returned, it is called when the component is unmounted — after delegated listener cleanup and `events` cleanup have run. Use it to unsubscribe from stores, cancel timers, or clean up any other side effects set up inside the handler.

`.mount()` returns a cleanup function that removes every listener and calls the handler teardown — delegated `.on()` registrations, `events` map listeners, and the returned teardown are all called in that order.

### Delegated listeners vs events

`.on(selector, type, handler)` and the `events` object in `.handler()` serve different purposes:

- **`.on()`** — use this for interactive elements inside the component's rendered content. Delegated to the root element, so listeners survive `render()` calls that swap `innerHTML`.
- **`events`** — use this for anything that needs the full `@poseui/on` API (multi-element selectors via `.targets()`, pre-mount registration, sharing an event map across components).

For most components, `.on()` alone is sufficient and the `events` parameter can be ignored entirely.

### Nesting components

Because `.handler()` returns something callable, components nest inside other elements and components exactly like plain `PoseElement` instances. A single `.mount()` on the outermost parent activates all event listeners for the whole tree — no manual mounting per child needed.

```ts
const saveBtn = pose
  .as("button")
  .cls("btn-primary")
  .attr("type", "submit")
  .child("Save")
  .handler(({ events }) => {
    events.target<HTMLButtonElement>("button[type=submit]").on("click", save);
  });

const form = pose
  .as("form")
  .cls("space-y-4")
  .child(saveBtn) // saveBtn renders as HTML here
  .handler(({ events }) => {
    events.target<HTMLFormElement>("form").on("submit", handleSubmit);
  });

// One mount — both form and saveBtn listeners activated via shared EventMap
const unmount = form.mount(document.querySelector("#app")!, createEventMap());

unmount(); // removes every listener
```

The shared `EventMap` is scoped to the mount root, so each component's selectors are queried within that subtree. Inner components render as HTML strings during the parent's build pass — their handlers register listeners on the same events instance, which is mounted once at the top.

### Reactive components with `.watch()`

The `reactive` preset adds `.watch(store, selector)` to the builder — a declarative alternative to manually wiring `store.subscribe` inside `.handler()`. Install it alongside `@poseui/store`:

```bash
bun add @poseui/store
```

```ts
import { createPose } from "poseui";
import { reactive } from "poseui/presets/reactive";
import { createEventMap } from "@poseui/on";
import { createStore } from "@poseui/store";
import { z } from "zod";

const pose = createPose({ presets: [reactive] });

const store = createStore((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
}));

const counter = pose
  .as("div")
  .input(z.object({ count: z.number().default(0) }))
  .child(
    ({ count }) => `
    <span>${count}</span>
    <button id="inc">+</button>
  `,
  )
  .on("#inc", "click", () => store.getState().increment())
  .watch(store, (s) => ({ count: s.count }));

counter.mount(document.querySelector("#app")!, createEventMap());
```

`.watch()` closes the builder into a `Component` — no `.handler()` needed. The subscription is set up and torn down automatically on mount and unmount. Multiple `.watch()` calls can be chained to subscribe to slices from different stores:

```ts
pose
  .as("div")
  .input(z.object({ count: z.number().default(0), name: z.string().default("") }))
  .child(({ count, name }) => `${name}: ${count}`)
  .watch(countStore, (s) => ({ count: s.count }))
  .watch(userStore, (s) => ({ name: s.user?.name ?? "" }));
```

The selector is compared by value on every state change — re-renders only fire when the selected slice actually changes, regardless of what else changes in the store. On initial mount, current store state is read and used as props, so the component always renders with live data immediately.

`.watch()` is compatible with `.on()` and works with any store that exposes `getState()` and `subscribe(selector, listener)` — not just `@poseui/store`.

## html\`\` tagged templates

For complex layouts that mix multiple elements, structural HTML, and raw markup, the `html` tagged template literal composes `PoseElement` instances into a larger template while keeping props threaded through the whole tree.

```ts
import { html } from "poseui";
```

### Slot types

An interpolation slot accepts three things:

- **`PoseElement`** — rendered with the template's current props (see [spread position](#spread-position) below for the special opening-tag behaviour)
- **`(props) => string | null | undefined`** — called with the current props at render time
- **`string | number | null | undefined`** — inserted literally; `null` and `undefined` emit nothing

### Basic usage

```ts
const emailLabel = pose.as("label").attr("for", "email");
const emailInput = pose.as("input").cls("form-input").attr("type", "email").attr("id", "email");

const field = html`
  <div class="grid gap-2">
    <label ${emailLabel}>Email</label>
    <input ${emailInput} />
  </div>
`;

field();
// → <div class="grid gap-2"><label for="email">Email</label><input class="form-input" type="email" id="email" /></div>
```

Call the template like a function — `field()` — and it returns the rendered HTML string.

### Props

Pass a type parameter to `html` to get typed props flowing through all function slots and child elements:

```ts
type LoginProps = {
  username: string;
  error: string | null;
};

const errorMsg = pose
  .as("p")
  .input(z.object({ error: z.string().nullable() }))
  .cls("text-red-500 text-sm")
  .child(({ error }) => error);

const loginForm = html<LoginProps>`
  <form method="post">
    <input type="text" name="username" value="${({ username }) => username}" />
    ${({ error }) => (error ? errorMsg : null)}
    <button type="submit">Log in</button>
  </form>
`;

loginForm({ username: "ada", error: "Invalid password" });
// → <form method="post"><input ... /><p class="text-red-500 text-sm">Invalid password</p><button ...>Log in</button></form>
```

Props flow into both function slots (`({ error }) => ...`) and `PoseElement` children — the same props object is passed to every slot in the tree on each render.

### Spread position

When a `PoseElement` is interpolated directly inside an opening tag — between the tag name and the closing `>` — its `class` and attributes are merged into that tag rather than rendered as a child element:

```ts
const card = pose.as("div").cls("rounded-xl shadow p-6");
const footer = pose.as("footer").cls("mt-4 flex gap-2");
const saveBtn = pose.as("button").attr("type", "submit").cls("btn-primary");

const cardTemplate = html`
  <div ${card}>
    <footer ${footer}>
      <button ${saveBtn}>Save</button>
    </footer>
  </div>
`;

cardTemplate();
// → <div class="rounded-xl shadow p-6"><footer class="mt-4 flex gap-2"><button type="submit" class="btn-primary">Save</button></footer></div>
```

This lets you define a `PoseElement` as a style and attribute bundle and spread it onto any host tag in a template, without the element's own tag being emitted. A `PoseElement` in any other position (between tags, inside text content) is fully rendered as usual.

Dynamic spread attributes work the same way — the props are passed through at render time:

```ts
const link = pose
  .as("a")
  .input(z.object({ external: z.boolean().default(false) }))
  .attr("target", ({ external }) => (external ? "_blank" : null))
  .attr("rel", ({ external }) => (external ? "noopener noreferrer" : null));

const nav = html<{ external: boolean }>`
  <nav>
    <a ${link} href="/docs">Documentation</a>
  </nav>
`;

nav({ external: true });
// → <nav><a target="_blank" rel="noopener noreferrer" href="/docs">Documentation</a></nav>

nav({ external: false });
// → <nav><a href="/docs">Documentation</a></nav>
```

### Nesting templates

A compiled template is just a `(props?) => string` function, so it slots naturally into another template as a function slot. The `slot()` helper is an explicit alias for the same thing — use whichever reads more clearly:

```ts
import { html, slot } from "poseui";

type Props = { username: string };

const greeting = html<Props>`<span>Hello, ${({ username }) => username}</span>`;

const page = html<Props>`
  <main>
    <header>${slot(greeting)}</header>
  </main>
`;

page({ username: "Ada" });
// → <main><header><span>Hello, Ada</span></header></main>
```

### Full example

```ts
import { html } from "poseui";
import { createPose } from "poseui";
import { z } from "zod";

const pose = createPose();

const card = pose.as("div").cls("rounded-xl shadow-md p-6 bg-white");
const loginForm = pose.as("form").attr("method", "post");
const emailLabel = pose.as("label").cls("text-sm font-medium").attr("for", "email");
const emailInput = pose
  .as("input")
  .cls("form-input w-full")
  .attrs({ type: "email", id: "email", name: "email" });
const cardFooter = pose.as("footer").cls("mt-4 flex justify-end gap-2");
const loginBtn = pose.as("button").cls("btn-primary").attr("type", "submit");
const googleBtn = pose.as("button").cls("btn-outline").attr("type", "button");

const loginCard = html`
  <div ${card}>
    <header>
      <h2 class="text-xl font-semibold">Login to your account</h2>
      <p class="text-sm text-gray-500">Enter your details below</p>
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

## Validation errors

```ts
import { PoseValidationError } from "poseui";

try {
  button({ variant: "oops" });
} catch (err) {
  if (err instanceof PoseValidationError) {
    console.log(err.issues); // StandardSchemaV1.Issue[]
  }
}
```

## License

MIT
