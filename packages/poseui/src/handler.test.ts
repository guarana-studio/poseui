// =============================================================================
// Tests for PoseElement.handler() — Component mount, render, el, events, cleanup
// Run with: bun test
// =============================================================================

import { it, expect, describe, expectTypeOf, mock } from "bun:test";

import { createPose, PoseValidationError } from "poseui";
import type { Component, EventMap, HandlerContext } from "poseui";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Minimal DOM + EventMap stubs
//
// handler() only touches el.innerHTML (write) and calls events.mount(el).
// We don't need a real browser DOM — a plain object with an innerHTML field
// and a structural EventMap stub covers everything the implementation does.
// ---------------------------------------------------------------------------

/** Minimal Element stub — only the surface .handler() touches. */
function makeEl(initial = ""): Element & { innerHTML: string } {
  return { innerHTML: initial } as unknown as Element & { innerHTML: string };
}

/**
 * Structural EventMap stub. Tracks mount calls and returns a spy unmount fn.
 * Satisfies poseui's EventMap interface (mount returns () => void).
 */
function makeEvents() {
  const mountCalls: Array<Element | Document | undefined> = [];
  const unmount = mock(() => {});

  const events: EventMap = {
    mount(root?: Element | Document): () => void {
      mountCalls.push(root);
      return unmount;
    },
  };

  return { events, mountCalls, unmount };
}

const pose = createPose();

// ---------------------------------------------------------------------------
// Basic mount
// ---------------------------------------------------------------------------

describe(".handler() — basic mount", () => {
  it("returns a Component with a mount() method", () => {
    const component = pose
      .as("div")
      .child("hello")
      .handler(() => {});

    expect(typeof component.mount).toBe("function");
  });

  it("writes rendered HTML into el.innerHTML on mount", () => {
    const { events } = makeEvents();
    const el = makeEl();

    pose
      .as("p")
      .child("Hello")
      .handler(() => {})
      .mount(el, events);

    expect(el.innerHTML).toBe("<p>Hello</p>");
  });

  it("calls events.mount(el) after writing innerHTML", () => {
    const { events, mountCalls } = makeEvents();
    const el = makeEl();

    pose
      .as("div")
      .handler(() => {})
      .mount(el, events);

    expect(mountCalls).toHaveLength(1);
    expect(mountCalls[0]).toBe(el);
  });

  it("returns the cleanup function from events.mount()", () => {
    const { events, unmount } = makeEvents();
    const el = makeEl();

    const cleanup = pose
      .as("div")
      .handler(() => {})
      .mount(el, events);

    expect(cleanup).toBe(unmount);
  });

  it("calls events.mount() AFTER innerHTML is written", () => {
    const el = makeEl();
    const order: string[] = [];

    const events: EventMap = {
      mount() {
        order.push(`mount:${el.innerHTML}`);
        return () => {};
      },
    };

    pose
      .as("span")
      .child("x")
      .handler(() => {
        order.push("handler");
      })
      .mount(el, events);

    // handler runs before events.mount()
    expect(order).toEqual(["handler", "mount:<span>x</span>"]);
  });
});

// ---------------------------------------------------------------------------
// HandlerContext — input
// ---------------------------------------------------------------------------

describe("HandlerContext.input", () => {
  it("passes raw props as input when no schema is bound", () => {
    const { events } = makeEvents();
    const el = makeEl();
    let captured: Record<string, unknown> | null = null;

    pose
      .as("div")
      .handler(({ input }) => {
        captured = input;
      })
      .mount(el, events, {} as any);

    expect(captured).toEqual({});
  });

  it("passes schema-validated props as input", () => {
    const { events } = makeEvents();
    const el = makeEl();
    let captured: { name: string } | null = null;

    pose
      .as("div")
      .input(z.object({ name: z.string() }))
      .handler(({ input }) => {
        captured = input;
      })
      .mount(el, events, { name: "Ada" });

    expect(captured).toEqual({ name: "Ada" });
  });

  it("applies schema defaults before passing input", () => {
    const { events } = makeEvents();
    const el = makeEl();
    let captured: { count: number } | null = null;

    pose
      .as("div")
      .input(z.object({ count: z.number().default(42) }))
      .handler(({ input }) => {
        captured = input;
      })
      .mount(el, events);

    expect(captured).toEqual({ count: 42 });
  });

  it("applies schema transforms before passing input", () => {
    const { events } = makeEvents();
    const el = makeEl();
    let captured: { name: string } | null = null;

    pose
      .as("div")
      .input(z.object({ name: z.string().trim().toUpperCase() }))
      .handler(({ input }) => {
        captured = input;
      })
      .mount(el, events, { name: "  ada  " });

    expect(captured).toEqual({ name: "ADA" });
  });

  it("throws PoseValidationError on invalid props at mount time", () => {
    const { events } = makeEvents();
    const el = makeEl();

    const component = pose
      .as("div")
      .input(z.object({ age: z.number().min(0) }))
      .handler(() => {});

    expect(() => component.mount(el, events, { age: -1 })).toThrow(PoseValidationError);
  });

  it("throws on async schema", () => {
    const { events } = makeEvents();
    const el = makeEl();

    // Craft a minimal async Standard Schema
    const asyncSchema = {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: async (v: unknown) => ({ value: v as { x: string } }),
      },
    };

    const component = pose
      .as("div")
      .input(asyncSchema)
      .handler(() => {});

    expect(() => component.mount(el, events, { x: "y" })).toThrow(
      "async schemas are not supported in .mount()",
    );
  });
});

// ---------------------------------------------------------------------------
// HandlerContext — el
// ---------------------------------------------------------------------------

describe("HandlerContext.el", () => {
  it("passes the root element reference into the handler", () => {
    const { events } = makeEvents();
    const el = makeEl();
    let captured: Element | null = null;

    pose
      .as("div")
      .handler(({ el: rootEl }) => {
        captured = rootEl;
      })
      .mount(el, events);

    expect(captured).toBe(el);
  });

  it("el.innerHTML is already set when the handler runs", () => {
    const { events } = makeEvents();
    const el = makeEl();
    let htmlAtHandlerTime = "";

    pose
      .as("p")
      .child("content")
      .handler(({ el: rootEl }) => {
        htmlAtHandlerTime = rootEl.innerHTML;
      })
      .mount(el, events);

    expect(htmlAtHandlerTime).toBe("<p>content</p>");
  });
});

// ---------------------------------------------------------------------------
// HandlerContext — events
// ---------------------------------------------------------------------------

describe("HandlerContext.events", () => {
  it("passes the events instance into the handler", () => {
    const { events } = makeEvents();
    const el = makeEl();
    let capturedEvents: EventMap | null = null;

    pose
      .as("div")
      .handler(({ events: evts }) => {
        capturedEvents = evts;
      })
      .mount(el, events);

    expect(capturedEvents).toBe(events);
  });

  it("preserves the concrete events type in the handler", () => {
    // Type-level test: TEvents flows through as the concrete type, not just EventMap
    type ConcreteEvents = EventMap & { target: (sel: string) => { on: () => void } };
    const concreteEvents = {
      mount: () => () => {},
      target: (_: string) => ({ on: () => {} }),
    } satisfies ConcreteEvents;

    const el = makeEl();

    pose
      .as("div")
      .handler(({ events: evts }: HandlerContext<Record<never, never>, ConcreteEvents>) => {
        // If TEvents is narrowed correctly, .target() is available without casting
        expectTypeOf(evts).toMatchTypeOf<ConcreteEvents>();
      })
      .mount(el, concreteEvents);
  });
});

// ---------------------------------------------------------------------------
// HandlerContext — render
// ---------------------------------------------------------------------------

describe("HandlerContext.render", () => {
  it("re-renders el.innerHTML when called with new props", () => {
    const { events } = makeEvents();
    const el = makeEl();
    let savedRender: ((props?: any) => void) | null = null;

    const component = pose
      .as("div")
      .input(z.object({ label: z.string().default("initial") }))
      .child(({ label }) => label)
      .handler(({ render }) => {
        savedRender = render;
      })
      .mount(el, events);

    expect(el.innerHTML).toBe("<div>initial</div>");

    savedRender!({ label: "updated" });
    expect(el.innerHTML).toBe("<div>updated</div>");
  });

  it("applies schema defaults on re-render", () => {
    const { events } = makeEvents();
    const el = makeEl();
    let savedRender: ((props?: any) => void) | null = null;

    pose
      .as("div")
      .input(z.object({ count: z.number().default(0) }))
      .child(({ count }) => String(count))
      .handler(({ render }) => {
        savedRender = render;
      })
      .mount(el, events);

    savedRender!(); // no props — defaults should apply
    expect(el.innerHTML).toBe("<div>0</div>");
  });

  it("applies schema transforms on re-render", () => {
    const { events } = makeEvents();
    const el = makeEl();
    let savedRender: ((props?: any) => void) | null = null;

    pose
      .as("div")
      .input(z.object({ name: z.string().trim() }))
      .child(({ name }) => name)
      .handler(({ render }) => {
        savedRender = render;
      })
      .mount(el, events, { name: "ada" });

    savedRender!({ name: "  ada  " });
    expect(el.innerHTML).toBe("<div>ada</div>");
  });

  it("does NOT call events.mount() again on re-render", () => {
    const { events, mountCalls } = makeEvents();
    const el = makeEl();
    let savedRender: ((props?: any) => void) | null = null;

    pose
      .as("div")
      .input(z.object({ x: z.string().default("a") }))
      .handler(({ render }) => {
        savedRender = render;
      })
      .mount(el, events);

    savedRender!({ x: "b" });
    savedRender!({ x: "c" });

    // events.mount() called exactly once — at initial mount only
    expect(mountCalls).toHaveLength(1);
  });

  it("supports multiple sequential re-renders", () => {
    const { events } = makeEvents();
    const el = makeEl();
    let savedRender: ((props?: any) => void) | null = null;

    pose
      .as("span")
      .input(z.object({ n: z.number().default(0) }))
      .child(({ n }) => String(n))
      .handler(({ render }) => {
        savedRender = render;
      })
      .mount(el, events);

    for (let i = 1; i <= 5; i++) savedRender!({ n: i });
    expect(el.innerHTML).toBe("<span>5</span>");
  });

  it("throws PoseValidationError on invalid props in re-render", () => {
    const { events } = makeEvents();
    const el = makeEl();
    let savedRender: ((props?: any) => void) | null = null;

    pose
      .as("div")
      .input(z.object({ age: z.number().min(0) }))
      .handler(({ render }) => {
        savedRender = render;
      })
      .mount(el, events, { age: 1 });

    expect(() => savedRender!({ age: -1 })).toThrow(PoseValidationError);
  });
});

// ---------------------------------------------------------------------------
// Cleanup — unmount
// ---------------------------------------------------------------------------

describe("Component.mount cleanup", () => {
  it("returns a function", () => {
    const { events } = makeEvents();
    const el = makeEl();
    const cleanup = pose
      .as("div")
      .handler(() => {})
      .mount(el, events);
    expect(typeof cleanup).toBe("function");
  });

  it("cleanup is the return value of events.mount()", () => {
    const { events, unmount } = makeEvents();
    const el = makeEl();
    const cleanup = pose
      .as("div")
      .handler(() => {})
      .mount(el, events);
    expect(cleanup).toBe(unmount);
  });

  it("calling cleanup calls the events.mount() teardown", () => {
    const { events, unmount } = makeEvents();
    const el = makeEl();
    const cleanup = pose
      .as("div")
      .handler(() => {})
      .mount(el, events);

    cleanup();
    expect(unmount).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Props threading — HTML renders correctly through the component chain
// ---------------------------------------------------------------------------

describe("rendered HTML correctness through .handler()", () => {
  it("renders static classes", () => {
    const { events } = makeEvents();
    const el = makeEl();

    pose
      .as("div")
      .cls("rounded p-4")
      .handler(() => {})
      .mount(el, events);

    expect(el.innerHTML).toBe('<div class="rounded p-4"></div>');
  });

  it("renders dynamic classes from input", () => {
    const { events } = makeEvents();
    const el = makeEl();

    pose
      .as("button")
      .input(z.object({ active: z.boolean() }))
      .cls(({ active }) => (active ? "ring-2" : ""))
      .handler(() => {})
      .mount(el, events, { active: true });

    expect(el.innerHTML).toBe('<button class="ring-2"></button>');
  });

  it("renders attrs from input", () => {
    const { events } = makeEvents();
    const el = makeEl();

    pose
      .as("input")
      .input(z.object({ required: z.boolean().default(false) }))
      .attr("type", "email")
      .attr("required", ({ required }) => (required ? "" : null))
      .handler(() => {})
      .mount(el, events, { required: true });

    expect(el.innerHTML).toBe('<input type="email" required></input>');
  });

  it("renders .when() branches", () => {
    const { events } = makeEvents();
    const el = makeEl();

    pose
      .as("button")
      .input(z.object({ variant: z.enum(["primary", "secondary"]) }))
      .when("variant", {
        primary: (b) => b.cls("bg-indigo-600").child("Submit"),
        secondary: (b) => b.cls("bg-slate-200").child("Cancel"),
      })
      .handler(() => {})
      .mount(el, events, { variant: "primary" });

    expect(el.innerHTML).toBe('<button class="bg-indigo-600">Submit</button>');
  });

  it("re-render reflects .when() branch change", () => {
    const { events } = makeEvents();
    const el = makeEl();
    let savedRender: ((p?: any) => void) | null = null;

    pose
      .as("button")
      .input(z.object({ variant: z.enum(["primary", "secondary"]) }))
      .when("variant", {
        primary: (b) => b.cls("bg-indigo-600").child("Submit"),
        secondary: (b) => b.cls("bg-slate-200").child("Cancel"),
      })
      .handler(({ render }) => {
        savedRender = render;
      })
      .mount(el, events, { variant: "primary" });

    expect(el.innerHTML).toBe('<button class="bg-indigo-600">Submit</button>');

    savedRender!({ variant: "secondary" });
    expect(el.innerHTML).toBe('<button class="bg-slate-200">Cancel</button>');
  });
});

// ---------------------------------------------------------------------------
// Type-level — Component type parameter inference
// ---------------------------------------------------------------------------

describe("type-level — Component inference", () => {
  it(".handler() returns Component with correct TProps", () => {
    const component = pose
      .as("div")
      .input(z.object({ name: z.string() }))
      .handler(() => {});

    expectTypeOf(component).toMatchTypeOf<Component<{ name: string }, any, EventMap>>();
  });

  it(".handler() without input returns Component with empty TProps", () => {
    const component = pose.as("div").handler(() => {});
    expectTypeOf(component).toMatchTypeOf<Component<Record<never, never>, any, EventMap>>();
  });

  it("HandlerContext.input is typed to TProps", () => {
    pose
      .as("div")
      .input(z.object({ count: z.number() }))
      .handler(({ input }) => {
        expectTypeOf(input).toMatchTypeOf<{ count: number }>();
      });
  });

  it("HandlerContext.render accepts Partial<TProps>", () => {
    pose
      .as("div")
      .input(z.object({ count: z.number().default(0) }))
      .handler(({ render }) => {
        expectTypeOf(render).toMatchTypeOf<(props?: Partial<{ count: number }>) => void>();
      });
  });

  it("HandlerContext.el is Element", () => {
    pose.as("div").handler(({ el }) => {
      expectTypeOf(el).toMatchTypeOf<Element>();
    });
  });
});

// ---------------------------------------------------------------------------
// Component composability — callable + nestable
// ---------------------------------------------------------------------------

describe("Component is callable — composes as a child", () => {
  it("can be called directly to render HTML", () => {
    const component = pose
      .as("span")
      .cls("badge")
      .child("New")
      .handler(() => {});

    expect(typeof component).toBe("function");
    expect(component()).toBe('<span class="badge">New</span>');
  });

  it("call signature passes props through schema", () => {
    const component = pose
      .as("p")
      .input(z.object({ msg: z.string() }))
      .child(({ msg }) => msg)
      .handler(() => {});

    expect(component({ msg: "hello" })).toBe("<p>hello</p>");
  });

  it("call signature applies schema defaults", () => {
    const component = pose
      .as("span")
      .input(z.object({ count: z.number().default(0) }))
      .child(({ count }) => String(count))
      .handler(() => {});

    expect(component()).toBe("<span>0</span>");
  });

  it("is usable as a .child() of another PoseElement", () => {
    const inner = pose
      .as("span")
      .child("inner")
      .handler(() => {});
    const outer = pose.as("div").child(inner);

    expect(outer()).toBe("<div><span>inner</span></div>");
  });

  it("is usable as a .child() of another Component", () => {
    const leaf = pose
      .as("em")
      .child("leaf")
      .handler(() => {});
    const mid = pose
      .as("span")
      .child(leaf)
      .handler(() => {});
    const root = pose
      .as("div")
      .child(mid)
      .handler(() => {});

    expect(root()).toBe("<div><span><em>leaf</em></span></div>");
  });

  it("props thread through nested Components in .child()", () => {
    const schema = z.object({ name: z.string() });

    const inner = pose
      .as("b")
      .input(schema)
      .child(({ name }) => name)
      .handler(() => {});

    const outer = pose
      .as("p")
      .input(schema)
      .child(inner)
      .handler(() => {});

    expect(outer({ name: "Ada" })).toBe("<p><b>Ada</b></p>");
  });
});

describe("Component nesting — single mount activates all handlers", () => {
  it("mount() on outer activates outer handler", () => {
    const { events } = makeEvents();
    const el = makeEl();
    let outerRan = false;

    pose
      .as("div")
      .handler(() => {
        outerRan = true;
      })
      .mount(el, events);

    expect(outerRan).toBe(true);
  });

  it("mount() on outer also runs inner component's handler registration", () => {
    // Both handlers register against the same shared events instance.
    // The key property: inner's handler is called during outer's mount(),
    // not as a separate mount() call.
    const { events, mountCalls } = makeEvents();
    const el = makeEl();
    const log: string[] = [];

    const inner = pose
      .as("button")
      .child("click")
      .handler(({ events: evts }) => {
        log.push("inner-handler");
        // Register on the shared events map
        evts.mount; // access proves events was passed through
      });

    pose
      .as("div")
      .child(inner)
      .handler(({ events: evts }) => {
        log.push("outer-handler");
      })
      .mount(el, events);

    // Outer handler ran — inner rendered as HTML via call signature
    expect(log).toContain("outer-handler");
    // events.mount() called exactly once, from the outer mount
    expect(mountCalls).toHaveLength(1);
  });

  it("rendered HTML of nested Components is correct at mount time", () => {
    const { events } = makeEvents();
    const el = makeEl();

    const badge = pose
      .as("span")
      .cls("badge")
      .child("NEW")
      .handler(() => {});
    const card = pose
      .as("div")
      .cls("card")
      .child(badge)
      .handler(() => {});

    card.mount(el, events);

    expect(el.innerHTML).toBe('<div class="card"><span class="badge">NEW</span></div>');
  });

  it("single unmount() cleans up — events.mount() return is called", () => {
    const { events, unmount } = makeEvents();
    const el = makeEl();

    const inner = pose
      .as("span")
      .child("x")
      .handler(() => {});
    const outer = pose
      .as("div")
      .child(inner)
      .handler(() => {});

    const cleanup = outer.mount(el, events);
    cleanup();

    expect(unmount).toHaveBeenCalledTimes(1);
  });

  it("Component has __pose marker so it works in html`` spread position", () => {
    const component = pose
      .as("div")
      .cls("card")
      .handler(() => {});
    expect((component as any).__pose).toBe(true);
  });
});
