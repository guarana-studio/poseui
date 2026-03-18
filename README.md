# poseui

> ⚠️ Prototype — API is unstable

Type-safe HTML templating engine with a fluent Tailwind v4 builder API. Inspired by [gpui](https://www.gpui.rs/).

Uses [UnoCSS](https://unocss.dev) + [presetWind4](https://unocss.dev/presets/wind4) for CSS generation and [Standard Schema](https://standardschema.dev) for prop validation.

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
    (b) => b.opacity(50).cursor_not_allowed(),
  )
  .child(({ variant }) => (variant === "primary" ? "Submit" : "Cancel"));

// just HTML — sync
button({ variant: "primary" });
// <button class="px-4 py-2 rounded font-semibold transition bg-indigo-600 text-white">Submit</button>

// HTML + generated CSS — async, runs UnoCSS
const { html, css } = await button.render({ variant: "primary" });
```

## Install

```bash
bun add poseui @unocss/core @unocss/preset-wind4
bun add zod  # or valibot, arktype, any Standard Schema lib
```

## Core concepts

**`pose.as(tag)`** — start a builder for any HTML tag.

**`.input(schema)`** — bind a [Standard Schema](https://standardschema.dev) object schema. Infers `TProps` from the output type, so `.default()` transforms work. Validates on every render, throws `PoseValidationError` on failure.

**Style methods** — mirror Tailwind v4 utilities. Every method that takes a value also accepts `(props: TProps) => value` for one-off dynamic styles. See the source for the full list.

**`.when(pred, apply)`** — apply styles when a predicate returns true:

```ts
.when(({ disabled }) => disabled, (b) => b.opacity(50).cursor_not_allowed())
```

**`.when(key, cases)`** — switch on a prop key and apply styles per matching case. Case keys are typed to the prop's actual union values — typos are compile errors:

```ts
.when("size", {
  sm: (b) => b.px(2).py(1).text_sm(),
  md: (b) => b.px(4).py(2).text_base(),
  lg: (b) => b.px(6).py(3).text_lg(),
})
```

Cases are `Partial` — unmatched values emit no classes. Multiple `.when()` calls stack independently.

**`.attr(name, value)`** — set a single HTML attribute. Value can be static or `(props) => string | null`. `null` omits the attribute; `""` renders it as a boolean attribute (`required`, `disabled`, etc.):

```ts
pose
  .as("a")
  .input(z.object({ url: z.string(), external: z.boolean() }))
  .attr("href", ({ url }) => url)
  .attr("target", ({ external }) => (external ? "_blank" : null))
  .attr("rel", ({ external }) => (external ? "noopener noreferrer" : null));
```

**`.attrs(record | fn)`** — set multiple attributes at once. Accepts a record of static/dynamic values, or a `(props) => Record<string, string | null>` function for when multiple attributes depend on each other:

```ts
// record form — each value is independently static or dynamic
pose.as("input").attrs({
  type: "text",
  name: ({ field }) => field,
  required: ({ required }) => (required ? "" : null),
});

// function form — whole object produced from props
pose.as("a").attrs(({ url, external }) => ({
  href: url,
  target: external ? "_blank" : null,
  rel: external ? "noopener noreferrer" : null,
}));
```

**`.cls(value)`** — escape hatch for anything not in the builder. Accepts a raw class string or `(props) => string`.

```ts
pose
  .as("div")
  .cls("hover:opacity-75")
  .cls(({ active }) => (active ? "ring-2 ring-blue-500" : ""));
```

**`.child(value | fn)`** — append children. Accepts a string, number, another `PoseElement`, an array of those, or `(props: TProps) => any of the above`. Chainable.

**`element(props)`** — render to an HTML string synchronously. If the bound schema has async validation, returns `Promise<string>`.

**`element.render(props)`** — render to `{ html, css }`. Runs UnoCSS against the rendered HTML to generate only the CSS rules that are actually used.

## Validation errors

```ts
import { PoseValidationError } from "poseui";

try {
  button({ variant: "primary" });
} catch (err) {
  if (err instanceof PoseValidationError) {
    console.log(err.issues); // StandardSchemaV1.Issue[]
  }
}
```

## License

MIT
