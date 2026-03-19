# Pose

Type-safe HTML templating engine with a fluent Tailwind-compatible builder API.

> ⚠️ Prototype — API is unstable

## Packages

| Package                       | Description                  |
| ----------------------------- | ---------------------------- |
| [`poseui`](./packages/poseui) | Core templating engine       |
| [`@poseui/on`](./packages/on) | Typed DOM event registration |

## Install

```bash
bun add poseui
bun add zod  # or valibot, arktype, any Standard Schema lib
```

## Example

```ts
import pose from "poseui";
import { z } from "zod";

const button = pose
  .as("button")
  .input(z.object({ variant: z.enum(["primary", "secondary"]).default("primary") }))
  .px(4)
  .py(2)
  .rounded()
  .font_semibold()
  .when("variant", {
    primary: (b) => b.bg("indigo-600").text_color("white"),
    secondary: (b) => b.bg("slate-200").text_color("slate-900"),
  })
  .child(({ variant }) => (variant === "primary" ? "Submit" : "Cancel"));

button({ variant: "primary" });
// → <button class="px-4 py-2 rounded font-semibold bg-indigo-600 text-white">Submit</button>
```

See [`poseui`](./packages/poseui) for the full API reference.

## License

MIT
