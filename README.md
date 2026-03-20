# Pose

> ⚠️ Prototype — API is unstable

Type-safe HTML templating engine with a fluent Tailwind-compatible builder API. A focused set of libraries for building web UIs in vanilla TypeScript — no framework required.

## Packages

| Package                             | Description                              |
| ----------------------------------- | ---------------------------------------- |
| [`poseui`](./packages/poseui)       | Core templating engine                   |
| [`@poseui/on`](./packages/on)       | Typed DOM event registration             |
| [`@poseui/match`](./packages/match) | Typed pattern matching for plain objects |

---

## `poseui`

Renders typed HTML strings from a fluent builder API. Zero dependencies. Fully synchronous.

```ts
import { createPose } from "poseui";
import { tailwind4 } from "poseui/presets";
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

button({ variant: "secondary", disabled: true });
// → <button class="px-4 py-2 rounded font-semibold transition bg-slate-200 text-slate-900 opacity-50 cursor-not-allowed">Cancel</button>
```

```bash
bun add poseui
bun add zod  # or valibot, arktype, any Standard Schema lib
```

See [`poseui`](./packages/poseui) for the full API reference.

---

## `@poseui/on`

Typed DOM event registration. Declare targets and handlers up front, activate them against a DOM subtree when you're ready, clean up with a single function call.

```ts
import { createEventMap } from "@poseui/on";

const events = createEventMap();

events.target<HTMLButtonElement>("#submit").on("click", (e) => {
  e.currentTarget.disabled = true; // e.currentTarget is HTMLButtonElement — no cast
});

events.target<HTMLInputElement>(".search").on("input", (e) => console.log(e.currentTarget.value));

events
  .targets<HTMLLIElement>("ul li")
  .on("mouseenter", (e) => e.currentTarget.classList.add("hovered"))
  .on("mouseleave", (e) => e.currentTarget.classList.remove("hovered"));

// Attach to a DOM subtree once your HTML is ready
const unmount = events.mount(document.querySelector("#app"));

// Full cleanup when navigating away or tearing down
unmount();
```

```bash
bun add @poseui/on
```

See [`@poseui/on`](./packages/on) for the full API reference.

---

## `@poseui/match`

Typed pattern matching for plain objects. Chain `.when()` conditions, collect results with `.resolve()`, `.first()`, `.last()`, or `.all()`. Default output type is `string` — no annotation needed for class string composition.

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

Pairs naturally with `poseui` via `.cls()`:

```ts
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

```bash
bun add @poseui/match
```

See [`@poseui/match`](./packages/match) for the full API reference.

---

## License

MIT
