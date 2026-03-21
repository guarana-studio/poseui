// =============================================================================
// Tests the engine with no preset. Zero tailwind dependency.
// Run with: bun test
// =============================================================================

import { it, expect, describe, expectTypeOf } from "bun:test";

import { PoseValidationError, div, createPose } from "poseui";
import type { PoseElement } from "poseui";
import { z } from "zod";

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
// .input() / schema
// ---------------------------------------------------------------------------

describe(".input()", () => {
  const pose = createPose();

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

  it("throws PoseValidationError on invalid props", () => {
    const el = pose
      .as("div")
      .input(z.object({ age: z.number().min(0) }))
      .child(({ age }) => String(age));

    expect(() => el({ age: -1 })).toThrow(PoseValidationError);
  });

  it("PoseValidationError has structured issues", () => {
    const el = pose.as("div").input(z.object({ name: z.string().min(1, "Name is required") }));

    try {
      el({ name: "" });
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(PoseValidationError);
      const e = err as PoseValidationError;
      expect(e.issues.length).toBeGreaterThan(0);
      expect(e.issues[0]?.message).toContain("Name is required");
    }
  });

  it("PoseValidationError message includes field path", () => {
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

  it("renders variant child via .when()", () => {
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
// .attr() — single attribute
// ---------------------------------------------------------------------------

describe(".attr()", () => {
  const pose = createPose();

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

  it("renders attributes with children", () => {
    expect(pose.as("a").attr("href", "/home").child("Home")()).toEqual('<a href="/home">Home</a>');
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
  const pose = createPose();

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
    expect(pose.as("div").attrs({ id: "box", "data-hidden": null })()).toEqual(
      '<div id="box"></div>',
    );
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
  const pose = createPose();

  it("returns an empty string when no classes are applied", () => {
    expect(pose.as("div").getClasses()).toEqual("");
  });

  it("evaluates dynamic .cls() entries against supplied props", () => {
    const el = pose
      .as("div")
      .input(z.object({ active: z.boolean().default(false) }))
      .cls(({ active }) => (active ? "is-active" : ""));

    expect(el.getClasses({ active: true })).toEqual("is-active");
    expect(el.getClasses({ active: false })).toEqual("");
  });

  it("defaults props to {} when called with no arguments", () => {
    const el = pose
      .as("div")
      .input(z.object({ active: z.boolean().default(false) }))
      .cls(({ active }) => (active ? "ring" : ""));

    expect(el.getClasses()).toEqual("");
  });
});

// ---------------------------------------------------------------------------
// createPose() + getAllClasses()
// ---------------------------------------------------------------------------

describe("createPose() and getAllClasses()", () => {
  it("returns a fresh independent instance", () => {
    const a = createPose();
    const b = createPose();
    a.as("div").cls("only-in-a");
    expect(b.getAllClasses()).toEqual("");
  });

  it("getAllClasses() is empty on a fresh instance", () => {
    expect(createPose().getAllClasses()).toEqual("");
  });

  it("collects static classes from .cls()", () => {
    const p = createPose();
    p.as("div").cls("foo").cls("bar");
    const all = p.getAllClasses();
    expect(all).toContain("foo");
    expect(all).toContain("bar");
  });

  it("collects static classes across multiple elements", () => {
    const p = createPose();
    p.as("div").cls("alpha");
    p.as("span").cls("beta");
    const all = p.getAllClasses();
    expect(all).toContain("alpha");
    expect(all).toContain("beta");
  });

  it("deduplicates classes shared across elements", () => {
    const p = createPose();
    p.as("div").cls("shared").cls("only-a");
    p.as("span").cls("shared").cls("only-b");
    const classes = p.getAllClasses().split(" ");
    expect(classes.filter((c) => c === "shared").length).toBe(1);
  });

  it("does not include dynamic (function) class entries", () => {
    const p = createPose();
    p.as("div")
      .input(z.object({ active: z.boolean().default(false) }))
      .cls("static")
      .cls(({ active }) => (active ? "dynamic-on" : "dynamic-off"));

    const all = p.getAllClasses();
    expect(all).toContain("static");
    expect(all).not.toContain("dynamic-on");
    expect(all).not.toContain("dynamic-off");
  });

  it("collects static classes from .when() branches", () => {
    const p = createPose();
    p.as("div")
      .input(z.object({ v: z.enum(["a", "b"]) }))
      .when("v", {
        a: (b) => b.cls("branch-a"),
        b: (b) => b.cls("branch-b"),
      });

    const all = p.getAllClasses();
    expect(all).toContain("branch-a");
    expect(all).toContain("branch-b");
  });

  it("getAllClasses() is stable across multiple calls", () => {
    const p = createPose();
    p.as("div").cls("x").cls("y");
    expect(p.getAllClasses()).toEqual(p.getAllClasses());
  });
});

// ---------------------------------------------------------------------------
// TTag — attr inference per element
// ---------------------------------------------------------------------------

describe("attr inference — tag-specific attribute names", () => {
  const pose = createPose();

  it("<a> renders href, target, rel", () => {
    expect(
      pose.as("a").attr("href", "/home").attr("target", "_blank").attr("rel", "noopener")(),
    ).toEqual('<a href="/home" target="_blank" rel="noopener"></a>');
  });

  it("<a> omits target when null", () => {
    expect(pose.as("a").attr("href", "/home").attr("target", null)()).toEqual(
      '<a href="/home"></a>',
    );
  });

  it("<a> renders download attribute", () => {
    expect(pose.as("a").attr("href", "/file.pdf").attr("download", "report.pdf")()).toEqual(
      '<a href="/file.pdf" download="report.pdf"></a>',
    );
  });

  it("<button> renders type attribute", () => {
    expect(pose.as("button").attr("type", "submit")()).toEqual('<button type="submit"></button>');
    expect(pose.as("button").attr("type", "reset")()).toEqual('<button type="reset"></button>');
    expect(pose.as("button").attr("type", "button")()).toEqual('<button type="button"></button>');
  });

  it("<button> renders disabled as boolean attribute", () => {
    expect(pose.as("button").attr("disabled", "")()).toEqual("<button disabled></button>");
  });

  it("<button> omits disabled when null", () => {
    expect(pose.as("button").attr("disabled", null)()).toEqual("<button></button>");
  });

  it("<button> renders name, value, form, formaction, formmethod", () => {
    expect(pose.as("button").attr("name", "action").attr("value", "submit")()).toEqual(
      '<button name="action" value="submit"></button>',
    );
    expect(pose.as("button").attr("form", "signup-form")()).toEqual(
      '<button form="signup-form"></button>',
    );
    expect(pose.as("button").attr("formaction", "/alt").attr("formmethod", "post")()).toEqual(
      '<button formaction="/alt" formmethod="post"></button>',
    );
  });

  it("<input> renders all type values", () => {
    const types = [
      "text",
      "email",
      "password",
      "number",
      "checkbox",
      "radio",
      "file",
      "date",
      "time",
      "tel",
      "url",
      "search",
      "range",
      "color",
      "hidden",
      "submit",
      "reset",
      "button",
      "image",
      "month",
      "week",
      "datetime-local",
    ] as const;
    for (const type of types) {
      expect(pose.as("input").attr("type", type)()).toEqual(`<input type="${type}"></input>`);
    }
  });

  it("<input> renders placeholder, name, id", () => {
    expect(
      pose.as("input").attrs({ name: "email", placeholder: "you@example.com", id: "email" })(),
    ).toEqual('<input name="email" placeholder="you@example.com" id="email"></input>');
  });

  it("<input> renders boolean attributes — required, readonly, disabled, checked, multiple", () => {
    expect(pose.as("input").attr("required", "")()).toEqual("<input required></input>");
    expect(pose.as("input").attr("readonly", "")()).toEqual("<input readonly></input>");
    expect(pose.as("input").attr("disabled", "")()).toEqual("<input disabled></input>");
    expect(pose.as("input").attr("checked", "")()).toEqual("<input checked></input>");
    expect(pose.as("input").attr("multiple", "")()).toEqual("<input multiple></input>");
  });

  it("<input> renders min, max, step, maxlength", () => {
    expect(pose.as("input").attrs({ type: "number", min: "0", max: "100", step: "1" })()).toEqual(
      '<input type="number" min="0" max="100" step="1"></input>',
    );
  });

  it("<input> renders autocomplete", () => {
    expect(pose.as("input").attr("autocomplete", "email")()).toEqual(
      '<input autocomplete="email"></input>',
    );
  });

  it("<textarea> renders rows, cols, placeholder, wrap, disabled, readonly", () => {
    expect(
      pose.as("textarea").attrs({ rows: "4", cols: "40", placeholder: "Your message" })(),
    ).toEqual('<textarea rows="4" cols="40" placeholder="Your message"></textarea>');
    expect(pose.as("textarea").attr("disabled", "").attr("readonly", "")()).toEqual(
      "<textarea disabled readonly></textarea>",
    );
    expect(pose.as("textarea").attr("wrap", "hard")()).toEqual('<textarea wrap="hard"></textarea>');
  });

  it("<select> renders name, required, disabled, multiple, size", () => {
    expect(
      pose.as("select").attrs({ name: "country", required: "", disabled: "", multiple: "" })(),
    ).toEqual('<select name="country" required disabled multiple></select>');
    expect(pose.as("select").attr("size", "5")()).toEqual('<select size="5"></select>');
  });

  it("<option> renders value, selected, disabled", () => {
    expect(
      pose
        .as("option")
        .attrs({ value: "gb", selected: "", disabled: "" })
        .child("United Kingdom")(),
    ).toEqual('<option value="gb" selected disabled>United Kingdom</option>');
  });

  it("<optgroup> renders label and disabled", () => {
    expect(pose.as("optgroup").attrs({ label: "Europe", disabled: "" })()).toEqual(
      '<optgroup label="Europe" disabled></optgroup>',
    );
  });

  it("<form> renders action, method, enctype, novalidate, target", () => {
    expect(
      pose
        .as("form")
        .attrs({ action: "/submit", method: "post", enctype: "multipart/form-data" })(),
    ).toEqual('<form action="/submit" method="post" enctype="multipart/form-data"></form>');
    expect(pose.as("form").attr("novalidate", "")()).toEqual("<form novalidate></form>");
    expect(pose.as("form").attr("target", "_blank")()).toEqual('<form target="_blank"></form>');
  });

  it("<label> uses 'for' not 'htmlFor'", () => {
    expect(pose.as("label").attr("for", "email").child("Email")()).toEqual(
      '<label for="email">Email</label>',
    );
  });

  it("<img> renders src, alt, width, height, loading, decoding, srcset, sizes", () => {
    expect(
      pose.as("img").attrs({ src: "/logo.png", alt: "Logo", width: "200", height: "50" })(),
    ).toEqual('<img src="/logo.png" alt="Logo" width="200" height="50"></img>');
    expect(pose.as("img").attr("loading", "lazy")()).toEqual('<img loading="lazy"></img>');
    expect(pose.as("img").attr("decoding", "async")()).toEqual('<img decoding="async"></img>');
    expect(
      pose.as("img").attrs({ srcset: "img-2x.png 2x", sizes: "(max-width: 600px) 100vw" })(),
    ).toEqual('<img srcset="img-2x.png 2x" sizes="(max-width: 600px) 100vw"></img>');
  });

  it("<video> renders src, controls, autoplay, muted, width, height, poster, preload", () => {
    expect(
      pose.as("video").attrs({ src: "/clip.mp4", controls: "", autoplay: "", muted: "" })(),
    ).toEqual('<video src="/clip.mp4" controls autoplay muted></video>');
    expect(
      pose
        .as("video")
        .attrs({ width: "640", height: "360", poster: "/thumb.jpg", preload: "metadata" })(),
    ).toEqual('<video width="640" height="360" poster="/thumb.jpg" preload="metadata"></video>');
  });

  it("<audio> renders src, controls, loop, muted", () => {
    expect(
      pose.as("audio").attrs({ src: "/track.mp3", controls: "", loop: "", muted: "" })(),
    ).toEqual('<audio src="/track.mp3" controls loop muted></audio>');
  });

  it("<iframe> renders src, width, height, title, allowfullscreen, sandbox", () => {
    expect(
      pose
        .as("iframe")
        .attrs({ src: "https://example.com", width: "600", height: "400", title: "Demo" })(),
    ).toEqual('<iframe src="https://example.com" width="600" height="400" title="Demo"></iframe>');
    expect(pose.as("iframe").attr("allowfullscreen", "")()).toEqual(
      "<iframe allowfullscreen></iframe>",
    );
    expect(pose.as("iframe").attr("sandbox", "allow-scripts allow-same-origin")()).toEqual(
      '<iframe sandbox="allow-scripts allow-same-origin"></iframe>',
    );
  });

  it("<script> renders src, type, async, defer", () => {
    expect(
      pose.as("script").attrs({ src: "/app.js", type: "module", async: "", defer: "" })(),
    ).toEqual('<script src="/app.js" type="module" async defer></script>');
  });

  it("<link> renders rel, href, type", () => {
    expect(
      pose.as("link").attrs({ rel: "stylesheet", href: "/app.css", type: "text/css" })(),
    ).toEqual('<link rel="stylesheet" href="/app.css" type="text/css"></link>');
  });

  it("<meta> renders name, content, charset", () => {
    expect(
      pose.as("meta").attrs({ name: "description", content: "My page description" })(),
    ).toEqual('<meta name="description" content="My page description"></meta>');
    expect(pose.as("meta").attr("charset", "UTF-8")()).toEqual('<meta charset="UTF-8"></meta>');
  });

  it("<td> renders colspan, rowspan, headers", () => {
    expect(pose.as("td").attrs({ colspan: "2", rowspan: "3", headers: "col1" })()).toEqual(
      '<td colspan="2" rowspan="3" headers="col1"></td>',
    );
  });

  it("<th> renders scope", () => {
    expect(pose.as("th").attr("scope", "col").child("Name")()).toEqual('<th scope="col">Name</th>');
  });

  it("<col> renders span", () => {
    expect(pose.as("col").attr("span", "2")()).toEqual('<col span="2"></col>');
  });

  it("<dialog> and <details> render open as boolean attribute", () => {
    expect(pose.as("dialog").attr("open", "")()).toEqual("<dialog open></dialog>");
    expect(pose.as("details").attr("open", "")()).toEqual("<details open></details>");
  });

  it("<progress> renders value and max", () => {
    expect(pose.as("progress").attrs({ value: "70", max: "100" })()).toEqual(
      '<progress value="70" max="100"></progress>',
    );
  });

  it("<meter> renders min, max, value, low, high, optimum", () => {
    expect(
      pose
        .as("meter")
        .attrs({ min: "0", max: "100", value: "60", low: "25", high: "75", optimum: "80" })(),
    ).toEqual('<meter min="0" max="100" value="60" low="25" high="75" optimum="80"></meter>');
  });

  it("global attrs — id, class, style, tabindex valid on every element", () => {
    const tags = ["div", "span", "p", "section", "article", "button", "input"] as const;
    for (const tag of tags) {
      expect(
        pose.as(tag).attrs({ id: "x", class: "foo", style: "color:red", tabindex: "0" })(),
      ).toContain('id="x"');
    }
  });

  it("global attrs — hidden, lang, dir, contenteditable, draggable", () => {
    expect(pose.as("div").attr("hidden", "")()).toEqual("<div hidden></div>");
    expect(pose.as("html").attr("lang", "en")()).toEqual('<html lang="en"></html>');
    expect(pose.as("p").attr("dir", "rtl").child("مرحبا")()).toEqual('<p dir="rtl">مرحبا</p>');
    expect(pose.as("div").attr("contenteditable", "true")()).toEqual(
      '<div contenteditable="true"></div>',
    );
    expect(pose.as("div").attr("draggable", "true")()).toEqual('<div draggable="true"></div>');
  });

  it("data-* attributes are always accepted", () => {
    expect(
      pose
        .as("div")
        .attrs({ "data-id": "42", "data-user-role": "admin", "data-testid": "container" })(),
    ).toEqual('<div data-id="42" data-user-role="admin" data-testid="container"></div>');
    expect(pose.as("button").attr("data-action", "close")()).toEqual(
      '<button data-action="close"></button>',
    );
  });

  it("aria-* attributes are always accepted", () => {
    expect(pose.as("button").attr("aria-label", "Close dialog")()).toEqual(
      '<button aria-label="Close dialog"></button>',
    );
    expect(pose.as("span").attr("aria-hidden", "true")()).toEqual(
      '<span aria-hidden="true"></span>',
    );
    expect(
      pose.as("button").attrs({ "aria-expanded": "false", "aria-controls": "menu" })(),
    ).toEqual('<button aria-expanded="false" aria-controls="menu"></button>');
    expect(pose.as("div").attr("role", "navigation")()).toEqual('<div role="navigation"></div>');
  });

  it("IDL normalisation — content attribute names, not JS property names", () => {
    expect(pose.as("div").attr("class", "foo bar")()).toEqual('<div class="foo bar"></div>');
    expect(pose.as("label").attr("for", "name")()).toEqual('<label for="name"></label>');
    expect(pose.as("div").attr("tabindex", "0")()).toEqual('<div tabindex="0"></div>');
    expect(pose.as("input").attr("readonly", "")()).toEqual("<input readonly></input>");
    expect(pose.as("input").attr("maxlength", "255")()).toEqual('<input maxlength="255"></input>');
    expect(pose.as("td").attr("colspan", "3")()).toEqual('<td colspan="3"></td>');
    expect(pose.as("td").attr("rowspan", "2")()).toEqual('<td rowspan="2"></td>');
  });

  it("TTag preserved through .cls(), .child(), .input()", () => {
    const a = pose.as("button").cls("x").attr("type", "button");
    expect(a()).toEqual('<button class="x" type="button"></button>');

    const b = pose.as("a").child("Link").attr("href", "/");
    expect(b()).toEqual('<a href="/">Link</a>');

    const c = pose
      .as("input")
      .input(z.object({ val: z.string().default("ada@example.com") }))
      .attr("type", "email")
      .attr("value", ({ val }) => val)
      .attr("required", "");
    expect(c()).toEqual('<input type="email" value="ada@example.com" required></input>');
  });

  it("dynamic attr value from props function", () => {
    const el = pose
      .as("a")
      .input(z.object({ external: z.boolean().default(false), url: z.string() }))
      .attr("href", ({ url }) => url)
      .attr("target", ({ external }) => (external ? "_blank" : null))
      .attr("rel", ({ external }) => (external ? "noopener noreferrer" : null));

    expect(el({ external: false, url: "/page" })).toEqual('<a href="/page"></a>');
    expect(el({ external: true, url: "https://ext.com" })).toEqual(
      '<a href="https://ext.com" target="_blank" rel="noopener noreferrer"></a>',
    );
  });

  it("type-level: .as() carries TTag through the chain", () => {
    expectTypeOf(pose.as("button")).toMatchTypeOf<PoseElement<any, any, "button">>();
    expectTypeOf(pose.as("input")).toMatchTypeOf<PoseElement<any, any, "input">>();
    expectTypeOf(pose.as("a")).toMatchTypeOf<PoseElement<any, any, "a">>();
  });

  it("type-level: TTag preserved through chain", () => {
    const el = pose.as("input").attr("type", "email").attr("required", "");
    expectTypeOf(el).toMatchTypeOf<PoseElement<any, any, "input">>();
  });
});
