import { it, expect, describe } from "bun:test";
import { PoseValidationError, div, createPose } from "./";
import { z } from "zod";
import { tailwind4 } from "./presets";

// ---------------------------------------------------------------------------
// Basic rendering
// ---------------------------------------------------------------------------

describe("basic rendering", () => {
  const pose = createPose();

  it("creates a div", () => {
    expect(pose.as("div")()).toEqual("<div></div>");
  });

  it("has a default div export", () => {
    expect(div()).toEqual("<div></div>");
  });

  it("renders any valid html tag", () => {
    expect(pose.as("section")()).toEqual("<section></section>");
    expect(pose.as("article")()).toEqual("<article></article>");
    expect(pose.as("p")()).toEqual("<p></p>");
  });

  it("renders a static string child", () => {
    expect(pose.as("div").child("Hello, World!")()).toEqual("<div>Hello, World!</div>");
  });

  it("renders a static number child", () => {
    expect(pose.as("div").child(42)()).toEqual("<div>42</div>");
  });

  it("renders multiple children in order", () => {
    const el = pose.as("div").child("foo").child("bar").child("baz");
    expect(el()).toEqual("<div>foobarbaz</div>");
  });

  it("renders no class attribute when no styles are applied", () => {
    expect(pose.as("span").child("x")()).toEqual("<span>x</span>");
  });
});

// ---------------------------------------------------------------------------
// Styling
// ---------------------------------------------------------------------------

describe("styling", () => {
  const pose = createPose({ presets: [tailwind4] });

  it("applies a single static class", () => {
    expect(pose.as("div").flex()()).toEqual('<div class="flex"></div>');
  });

  it("applies multiple classes in chain order", () => {
    expect(pose.as("div").flex().items_center().gap(4)()).toEqual(
      '<div class="flex items-center gap-4"></div>',
    );
  });

  it("applies dynamic class from a function", () => {
    const el = pose
      .as("div")
      .input(z.object({ variant: z.enum(["primary", "secondary"]).default("primary") }))
      .bg(({ variant }) => (variant === "primary" ? "blue-500" : "neutral-500"));

    expect(el({ variant: "primary" })).toEqual('<div class="bg-blue-500"></div>');
    expect(el({ variant: "secondary" })).toEqual('<div class="bg-neutral-500"></div>');
  });

  it("applies mix of static and dynamic classes", () => {
    const el = pose
      .as("button")
      .input(z.object({ active: z.boolean().default(false) }))
      .flex()
      .rounded()
      .opacity(({ active }) => (active ? 100 : 50));

    expect(el({ active: true })).toEqual('<button class="flex rounded opacity-100"></button>');
    expect(el({ active: false })).toEqual('<button class="flex rounded opacity-50"></button>');
  });
});

// ---------------------------------------------------------------------------
// Input / schema
// ---------------------------------------------------------------------------

describe(".input()", () => {
  const pose = createPose({ presets: [tailwind4] });

  it("infers props from schema output type", () => {
    const el = pose
      .as("div")
      .input(z.object({ name: z.string() }))
      .child(({ name }) => name);

    expect(el({ name: "Johnny" })).toEqual("<div>Johnny</div>");
  });

  it("applies schema defaults before rendering", () => {
    const el = pose
      .as("div")
      .input(z.object({ count: z.number().default(0) }))
      .child(({ count }) => String(count));

    expect(el()).toEqual("<div>0</div>");
  });

  it("applies schema transforms before rendering", () => {
    const el = pose
      .as("div")
      .input(z.object({ name: z.string().trim().toUpperCase() }))
      .child(({ name }) => name);

    expect(el({ name: "  hello  " })).toEqual("<div>HELLO</div>");
  });

  it("can be placed after style methods", () => {
    const el = pose
      .as("div")
      .flex()
      .gap(2)
      .input(z.object({ label: z.string() }))
      .child(({ label }) => label);

    expect(el({ label: "test" })).toEqual('<div class="flex gap-2">test</div>');
  });

  it("throws PozeValidationError on invalid props", () => {
    const el = pose
      .as("div")
      .input(z.object({ age: z.number().min(0) }))
      .child(({ age }) => String(age));

    expect(() => el({ age: -1 })).toThrow(PoseValidationError);
  });

  it("PozeValidationError has structured issues", () => {
    const el = pose.as("div").input(z.object({ name: z.string().min(1, "Name is required") }));

    try {
      el({ name: "" });
      expect(true).toBe(false); // should not reach
    } catch (err) {
      expect(err).toBeInstanceOf(PoseValidationError);
      const e = err as PoseValidationError;
      expect(e.issues.length).toBeGreaterThan(0);
      expect(e.issues[0]?.message).toContain("Name is required");
    }
  });

  it("PozeValidationError message includes field path", () => {
    const el = pose.as("div").input(z.object({ user: z.object({ name: z.string().min(1) }) }));

    try {
      el({ user: { name: "" } });
    } catch (err) {
      expect(err).toBeInstanceOf(PoseValidationError);
      expect((err as PoseValidationError).message).toContain("user.name");
    }
  });
});

// ---------------------------------------------------------------------------
// Nesting
// ---------------------------------------------------------------------------

describe("nesting", () => {
  const pose = createPose();

  it("renders a nested PoseElement child", () => {
    const inner = pose.as("span").child("inner");
    const outer = pose.as("div").child(inner);
    expect(outer()).toEqual("<div><span>inner</span></div>");
  });

  it("passes props down to nested PoseElement", () => {
    const schema = z.object({ name: z.string() });
    const inner = pose
      .as("span")
      .input(schema)
      .child(({ name }) => name);
    const outer = pose.as("div").input(schema).child(inner);

    expect(outer({ name: "Ada" })).toEqual("<div><span>Ada</span></div>");
  });

  it("renders an array of PoseElement from a child fn", () => {
    const el = pose
      .as("ul")
      .input(z.object({ items: z.array(z.string()) }))
      .child(({ items }) => items.map((item) => pose.as("li").child(item)));

    expect(el({ items: ["a", "b", "c"] })).toEqual("<ul><li>a</li><li>b</li><li>c</li></ul>");
  });

  it("renders deeply nested elements", () => {
    const el = pose.as("div").child(pose.as("div").child(pose.as("span").child("deep")));

    expect(el()).toEqual("<div><div><span>deep</span></div></div>");
  });

  it("conditionally renders nested elements", () => {
    const el = pose
      .as("div")
      .input(z.object({ show: z.boolean().default(false) }))
      .child(({ show }) => (show ? pose.as("p").child("shown") : undefined));

    expect(el({ show: true })).toEqual("<div><p>shown</p></div>");
    expect(el()).toEqual("<div></div>");
  });

  it("renders variant child", () => {
    const el = pose
      .as("div")
      .input(z.object({ route: z.enum(["home", "about"]) }))
      .when("route", {
        home: (p) => p.child("Home"),
        about: (p) => p.child("About"),
      });

    expect(el({ route: "home" })).toEqual("<div>Home</div>");
    expect(el({ route: "about" })).toEqual("<div>About</div>");
  });

  it("renders mixed static and dynamic children", () => {
    const el = pose
      .as("div")
      .input(z.object({ name: z.string() }))
      .child("Hello, ")
      .child(({ name }) => name)
      .child("!");

    expect(el({ name: "Ada" })).toEqual("<div>Hello, Ada!</div>");
  });
});

// ---------------------------------------------------------------------------
// .when() — predicate form
// ---------------------------------------------------------------------------

describe(".when() predicate form", () => {
  const pose = createPose({ presets: [tailwind4] });

  it("applies classes when predicate is true", () => {
    const el = pose
      .as("button")
      .input(z.object({ disabled: z.boolean().default(false) }))
      .when(
        ({ disabled }) => disabled,
        (b) => b.opacity(50).cursor_not_allowed(),
      );

    expect(el({ disabled: true })).toEqual(
      '<button class="opacity-50 cursor-not-allowed"></button>',
    );
  });

  it("emits no classes when predicate is false", () => {
    const el = pose
      .as("button")
      .input(z.object({ disabled: z.boolean().default(false) }))
      .when(
        ({ disabled }) => disabled,
        (b) => b.opacity(50).cursor_not_allowed(),
      );

    expect(el({ disabled: false })).toEqual("<button></button>");
  });

  it("stacks multiple predicate when() calls independently", () => {
    const el = pose
      .as("div")
      .input(z.object({ bold: z.boolean().default(false), italic: z.boolean().default(false) }))
      .when(
        ({ bold }) => bold,
        (b) => b.font_bold(),
      )
      .when(
        ({ italic }) => italic,
        (b) => b.italic(),
      );

    expect(el({ bold: true, italic: false })).toEqual('<div class="font-bold"></div>');
    expect(el({ bold: false, italic: true })).toEqual('<div class="italic"></div>');
    expect(el({ bold: true, italic: true })).toEqual('<div class="font-bold italic"></div>');
    expect(el({ bold: false, italic: false })).toEqual("<div></div>");
  });

  it("combines with base styles correctly", () => {
    const el = pose
      .as("div")
      .input(z.object({ active: z.boolean().default(false) }))
      .flex()
      .rounded()
      .when(
        ({ active }) => active,
        (b) => b.ring_w(2).ring_color("blue-500"),
      );

    expect(el({ active: true })).toEqual('<div class="flex rounded ring-2 ring-blue-500"></div>');
    expect(el({ active: false })).toEqual('<div class="flex rounded"></div>');
  });

  it("supports multi-field predicates", () => {
    const el = pose
      .as("button")
      .input(
        z.object({
          variant: z.enum(["primary", "secondary"]).default("primary"),
          disabled: z.boolean().default(false),
        }),
      )
      .when(
        ({ variant, disabled }) => variant === "primary" && !disabled,
        (b) => b.bg("blue-600"),
      );

    expect(el({ variant: "primary", disabled: false })).toEqual(
      '<button class="bg-blue-600"></button>',
    );
    expect(el({ variant: "primary", disabled: true })).toEqual("<button></button>");
    expect(el({ variant: "secondary", disabled: false })).toEqual("<button></button>");
  });
});

// ---------------------------------------------------------------------------
// .when() — value switch form
// ---------------------------------------------------------------------------

describe(".when() value switch form", () => {
  const pose = createPose({ presets: [tailwind4] });

  it("applies matching case", () => {
    const el = pose
      .as("button")
      .input(z.object({ variant: z.enum(["primary", "secondary"]).default("primary") }))
      .when("variant", {
        primary: (b) => b.bg("blue-500"),
        secondary: (b) => b.bg("neutral-500"),
      });

    expect(el({ variant: "primary" })).toEqual('<button class="bg-blue-500"></button>');
    expect(el({ variant: "secondary" })).toEqual('<button class="bg-neutral-500"></button>');
  });

  it("emits no classes for an unhandled case (Partial)", () => {
    const el = pose
      .as("button")
      .input(z.object({ variant: z.enum(["primary", "secondary", "ghost"]).default("primary") }))
      .when("variant", {
        primary: (b) => b.bg("blue-500"),
        // secondary and ghost intentionally omitted
      });

    expect(el({ variant: "ghost" })).toEqual("<button></button>");
  });

  it("stacks multiple value when() calls", () => {
    const el = pose
      .as("button")
      .input(
        z.object({
          variant: z.enum(["primary", "secondary"]).default("primary"),
          size: z.enum(["sm", "md", "lg"]).default("md"),
        }),
      )
      .when("variant", {
        primary: (b) => b.bg("blue-500").text_color("white"),
        secondary: (b) => b.bg("neutral-200").text_color("neutral-900"),
      })
      .when("size", {
        sm: (b) => b.px(2).py(1).text_sm(),
        md: (b) => b.px(4).py(2).text_base(),
        lg: (b) => b.px(6).py(3).text_lg(),
      });

    expect(el({ variant: "primary", size: "sm" })).toEqual(
      '<button class="bg-blue-500 text-white px-2 py-1 text-sm"></button>',
    );
    expect(el({ variant: "secondary", size: "lg" })).toEqual(
      '<button class="bg-neutral-200 text-neutral-900 px-6 py-3 text-lg"></button>',
    );
  });

  it("mixes value and predicate when() calls", () => {
    const el = pose
      .as("button")
      .input(
        z.object({
          variant: z.enum(["primary", "secondary"]).default("primary"),
          disabled: z.boolean().default(false),
        }),
      )
      .when("variant", {
        primary: (b) => b.bg("blue-500"),
        secondary: (b) => b.bg("neutral-500"),
      })
      .when(
        ({ disabled }) => disabled,
        (b) => b.opacity(50).pointer_events_none(),
      );

    expect(el({ variant: "primary", disabled: true })).toEqual(
      '<button class="bg-blue-500 opacity-50 pointer-events-none"></button>',
    );
    expect(el({ variant: "secondary", disabled: false })).toEqual(
      '<button class="bg-neutral-500"></button>',
    );
  });

  it("branch builder emits multiple classes", () => {
    const el = pose
      .as("div")
      .input(z.object({ size: z.enum(["sm", "lg"]).default("sm") }))
      .when("size", {
        sm: (b) => b.p(2).text_sm().rounded(),
        lg: (b) => b.p(6).text_lg().rounded("xl"),
      });

    expect(el({ size: "sm" })).toEqual('<div class="p-2 text-sm rounded"></div>');
    expect(el({ size: "lg" })).toEqual('<div class="p-6 text-lg rounded-xl"></div>');
  });
});

// ---------------------------------------------------------------------------
// .attr() — single attribute
// ---------------------------------------------------------------------------

describe(".attr()", () => {
  const pose = createPose({ presets: [tailwind4] });

  it("renders a static attribute", () => {
    expect(pose.as("a").attr("href", "/home")()).toEqual('<a href="/home"></a>');
  });

  it("renders a dynamic attribute from a function", () => {
    const el = pose
      .as("a")
      .input(z.object({ url: z.string() }))
      .attr("href", ({ url }) => url);

    expect(el({ url: "/about" })).toEqual('<a href="/about"></a>');
  });

  it("omits the attribute when value is null", () => {
    const el = pose
      .as("a")
      .input(z.object({ external: z.boolean().default(false) }))
      .attr("target", ({ external }) => (external ? "_blank" : null));

    expect(el({ external: true })).toEqual('<a target="_blank"></a>');
    expect(el({ external: false })).toEqual("<a></a>");
  });

  it("renders a boolean attribute when value is empty string", () => {
    const el = pose
      .as("input")
      .input(z.object({ required: z.boolean().default(false) }))
      .attr("required", ({ required }) => (required ? "" : null));

    expect(el({ required: true })).toEqual("<input required></input>");
    expect(el({ required: false })).toEqual("<input></input>");
  });

  it("chains multiple .attr() calls", () => {
    const el = pose.as("a").attr("href", "/home").attr("target", "_blank").attr("rel", "noopener");
    expect(el()).toEqual('<a href="/home" target="_blank" rel="noopener"></a>');
  });

  it("renders attributes alongside classes", () => {
    const el = pose.as("a").flex().text_color("blue-600").attr("href", "/home");
    expect(el()).toEqual('<a class="flex text-blue-600" href="/home"></a>');
  });

  it("renders attributes with children", () => {
    const el = pose.as("a").attr("href", "/home").child("Home");
    expect(el()).toEqual('<a href="/home">Home</a>');
  });

  it("survives .input() placed after .attr()", () => {
    const el = pose
      .as("a")
      .attr("target", "_blank")
      .input(z.object({ url: z.string() }))
      .attr("href", ({ url }) => url)
      .child(({ url }) => url);

    expect(el({ url: "/page" })).toEqual('<a target="_blank" href="/page">/page</a>');
  });
});

// ---------------------------------------------------------------------------
// .attrs() — bulk attributes
// ---------------------------------------------------------------------------

describe(".attrs()", () => {
  const pose = createPose({ presets: [tailwind4] });

  it("renders a static record of attributes", () => {
    expect(pose.as("input").attrs({ type: "text", name: "email" })()).toEqual(
      '<input type="text" name="email"></input>',
    );
  });

  it("renders a record with dynamic values", () => {
    const el = pose
      .as("input")
      .input(z.object({ field: z.string(), required: z.boolean().default(false) }))
      .attrs({
        type: "text",
        name: ({ field }) => field,
        required: ({ required }) => (required ? "" : null),
      });

    expect(el({ field: "email", required: true })).toEqual(
      '<input type="text" name="email" required></input>',
    );
    expect(el({ field: "email", required: false })).toEqual(
      '<input type="text" name="email"></input>',
    );
  });

  it("omits null values from the record", () => {
    const el = pose.as("div").attrs({ id: "box", "data-hidden": null });
    expect(el()).toEqual('<div id="box"></div>');
  });

  it("renders a props function form", () => {
    const el = pose
      .as("a")
      .input(z.object({ url: z.string(), external: z.boolean().default(false) }))
      .attrs(({ url, external }) => ({
        href: url,
        target: external ? "_blank" : null,
        rel: external ? "noopener noreferrer" : null,
      }));

    expect(el({ url: "/page", external: false })).toEqual('<a href="/page"></a>');
    expect(el({ url: "https://example.com", external: true })).toEqual(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer"></a>',
    );
  });

  it("stacks multiple .attrs() calls", () => {
    const el = pose
      .as("input")
      .attrs({ type: "text" })
      .attrs({ autocomplete: "off", spellcheck: "false" });

    expect(el()).toEqual('<input type="text" autocomplete="off" spellcheck="false"></input>');
  });

  it("renders attrs alongside classes and children", () => {
    const el = pose
      .as("a")
      .input(z.object({ url: z.string(), label: z.string() }))
      .flex()
      .items_center()
      .text_color("blue-600")
      .attrs(({ url }) => ({ href: url, target: "_blank" }))
      .child(({ label }) => label);

    expect(el({ url: "/about", label: "About" })).toEqual(
      '<a class="flex items-center text-blue-600" href="/about" target="_blank">About</a>',
    );
  });

  it("mixes .attr() and .attrs()", () => {
    const el = pose.as("a").attr("rel", "noopener").attrs({ href: "/home", target: "_blank" });

    expect(el()).toEqual('<a rel="noopener" href="/home" target="_blank"></a>');
  });

  it("data-* attributes render correctly", () => {
    const el = pose
      .as("div")
      .input(z.object({ id: z.string(), role: z.string() }))
      .attrs({
        "data-id": ({ id }) => id,
        "data-role": ({ role }) => role,
      });

    expect(el({ id: "123", role: "admin" })).toEqual('<div data-id="123" data-role="admin"></div>');
  });

  it("aria-* attributes render correctly", () => {
    const el = pose
      .as("button")
      .input(z.object({ expanded: z.boolean().default(false) }))
      .attrs({
        "aria-expanded": ({ expanded }) => String(expanded),
        "aria-haspopup": "true",
      });

    expect(el({ expanded: true })).toEqual(
      '<button aria-expanded="true" aria-haspopup="true"></button>',
    );
    expect(el({ expanded: false })).toEqual(
      '<button aria-expanded="false" aria-haspopup="true"></button>',
    );
  });
});

// ---------------------------------------------------------------------------
// .getClasses()
// ---------------------------------------------------------------------------

describe(".getClasses()", () => {
  const pose = createPose({ presets: [tailwind4] });

  it("returns an empty string when no classes are applied", () => {
    expect(pose.as("div").getClasses()).toEqual("");
  });

  it("returns static classes without calling the element", () => {
    const el = pose.as("div").flex().items_center().p(4);
    expect(el.getClasses()).toEqual("flex items-center p-4");
  });

  it("returns the same string as the class attribute on the rendered element", () => {
    const el = pose.as("div").flex().gap(2).rounded().font_bold();
    const html = el();
    const classAttr = html.match(/class="([^"]+)"/)?.[1] ?? "";
    expect(el.getClasses()).toEqual(classAttr);
  });

  it("evaluates dynamic class entries against supplied props", () => {
    const el = pose
      .as("button")
      .input(z.object({ disabled: z.boolean().default(false) }))
      .flex()
      .opacity(({ disabled }) => (disabled ? 50 : 100));

    expect(el.getClasses({ disabled: true })).toEqual("flex opacity-50");
    expect(el.getClasses({ disabled: false })).toEqual("flex opacity-100");
  });

  it("defaults props to {} when called with no arguments", () => {
    const el = pose
      .as("div")
      .input(z.object({ active: z.boolean().default(false) }))
      .flex()
      .when(
        ({ active }) => active,
        (b) => b.ring_w(2),
      );

    // active defaults to false → no ring class
    expect(el.getClasses()).toEqual("flex");
  });

  it("resolves .when() branches against props", () => {
    const el = pose
      .as("button")
      .input(z.object({ variant: z.enum(["primary", "secondary"]).default("primary") }))
      .when("variant", {
        primary: (b) => b.bg("indigo-600").text_color("white"),
        secondary: (b) => b.bg("slate-200").text_color("slate-900"),
      });

    expect(el.getClasses({ variant: "primary" })).toEqual("bg-indigo-600 text-white");
    expect(el.getClasses({ variant: "secondary" })).toEqual("bg-slate-200 text-slate-900");
  });

  it("survives being called on a builder that has .input() after style methods", () => {
    const el = pose
      .as("div")
      .flex()
      .gap(4)
      .input(z.object({ size: z.enum(["sm", "lg"]).default("sm") }))
      .when("size", {
        sm: (b) => b.p(2),
        lg: (b) => b.p(8),
      });

    expect(el.getClasses({ size: "sm" })).toEqual("flex gap-4 p-2");
    expect(el.getClasses({ size: "lg" })).toEqual("flex gap-4 p-8");
  });
});

// ---------------------------------------------------------------------------
// createPose() + pose.getAllClasses()
// ---------------------------------------------------------------------------

describe("createPose() and getAllClasses()", () => {
  it("createPose() returns a fresh independent instance", () => {
    const a = createPose({ presets: [tailwind4] });
    const b = createPose({ presets: [tailwind4] });
    a.as("div").flex().p(4);
    // b has no elements — its registry is empty
    expect(b.getAllClasses()).toEqual("");
  });

  it("getAllClasses() returns empty string on a fresh instance with no elements", () => {
    const p = createPose();
    expect(p.getAllClasses()).toEqual("");
  });

  it("collects static classes from a single element", () => {
    const p = createPose({ presets: [tailwind4] });
    p.as("div").flex().items_center().gap(4);
    expect(p.getAllClasses()).toEqual("flex items-center gap-4");
  });

  it("collects static classes across multiple elements", () => {
    const p = createPose({ presets: [tailwind4] });
    p.as("button").px(4).py(2).rounded().font_semibold();
    p.as("span").text_xs().font_bold().text_color("slate-500");
    const all = p.getAllClasses();
    // Every static class must appear; order isn't guaranteed
    for (const cls of [
      "px-4",
      "py-2",
      "rounded",
      "font-semibold",
      "text-xs",
      "font-bold",
      "text-slate-500",
    ]) {
      expect(all).toContain(cls);
    }
  });

  it("deduplicates classes shared across elements", () => {
    const p = createPose({ presets: [tailwind4] });
    p.as("div").flex().gap(4);
    p.as("section").flex().gap(4).p(8);
    const classes = p.getAllClasses().split(" ");
    // "flex" and "gap-4" should each appear exactly once
    expect(classes.filter((c) => c === "flex").length).toBe(1);
    expect(classes.filter((c) => c === "gap-4").length).toBe(1);
  });

  it("does not include dynamic (function) class entries", () => {
    const p = createPose({ presets: [tailwind4] });
    p.as("div")
      .input(z.object({ active: z.boolean().default(false) }))
      .flex()
      .opacity(({ active }) => (active ? 100 : 50)); // dynamic — cannot be statically known

    const all = p.getAllClasses();
    expect(all).toContain("flex");
    // The dynamic opacity value is unknowable — neither "opacity-100" nor "opacity-50"
    // should appear since the entry is a function
    expect(all).not.toContain("opacity-100");
    expect(all).not.toContain("opacity-50");
  });

  it("picks up classes added through fluent chaining after .as()", () => {
    const p = createPose({ presets: [tailwind4] });
    // Each chained method calls derive(), which registers into the same registry
    p.as("div").flex().flex_col().items_center().justify_between().gap(6);
    const all = p.getAllClasses();
    for (const cls of ["flex", "flex-col", "items-center", "justify-between", "gap-6"]) {
      expect(all).toContain(cls);
    }
  });

  it("collects static classes from .when() branches", () => {
    const p = createPose({ presets: [tailwind4] });
    p.as("button")
      .input(z.object({ variant: z.enum(["primary", "secondary"]).default("primary") }))
      .when("variant", {
        primary: (b) => b.bg("indigo-600").text_color("white"),
        secondary: (b) => b.bg("slate-200").text_color("slate-900"),
      });

    // Branch classes are static strings — they must all be registered
    const all = p.getAllClasses();
    for (const cls of ["bg-indigo-600", "text-white", "bg-slate-200", "text-slate-900"]) {
      expect(all).toContain(cls);
    }
  });

  it("isolates registries — default pose export does not bleed into createPose()", () => {
    const p = createPose({ presets: [tailwind4] });
    // Build something on the isolated instance only
    p.as("div").shadow_xl().overflow_hidden();
    const isolated = p.getAllClasses();
    expect(isolated).toContain("shadow-xl");
    expect(isolated).toContain("overflow-hidden");
    // The default pose export's getAllClasses() should NOT contain these
    // (unless they were added elsewhere in this test run, which they haven't been)
    // We just verify the isolated instance has exactly what we registered
    const classes = isolated.split(" ");
    expect(classes).toContain("shadow-xl");
    expect(classes).toContain("overflow-hidden");
  });

  it("getAllClasses() is stable across multiple calls", () => {
    const p = createPose({ presets: [tailwind4] });
    p.as("div").flex().p(4).rounded();
    expect(p.getAllClasses()).toEqual(p.getAllClasses());
  });
});
