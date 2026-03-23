// =============================================================================
// reactive test suite
// Run with: bun test
// =============================================================================

import { describe, it, expect, mock, beforeEach } from "bun:test";

import { createStore } from "@poseui/store";
import { createPose } from "poseui";
import { z } from "zod";

import { reactive } from "./";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal Element stub — only the surface .handler() touches. */
function makeEl(initial = ""): Element & { innerHTML: string } {
  return { innerHTML: initial } as unknown as Element & { innerHTML: string };
}

/** Minimal EventMap stub. */
function makeEvents() {
  const unmount = mock(() => {});
  const events = {
    mount(_root?: Element | Document): () => void {
      return unmount;
    },
  };
  return { events, unmount };
}

const pose = createPose({ presets: [reactive] });

beforeEach(() => {});

// ---------------------------------------------------------------------------
// .watch() — basic rendering
// ---------------------------------------------------------------------------

describe(".watch() — basic rendering", () => {
  it("renders immediately with the initial store state", () => {
    const store = createStore({ count: 0 });
    const { events } = makeEvents();
    const el = makeEl();

    pose
      .as("div")
      .input(z.object({ count: z.number().default(0) }))
      .child(({ count }) => String(count))
      .watch(store, (s) => ({ count: s.count }))
      .mount(el, events);

    expect(el.innerHTML).toBe("<div>0</div>");
  });

  it("re-renders when the watched slice changes", () => {
    const store = createStore({ count: 0 });
    const { events } = makeEvents();
    const el = makeEl();

    pose
      .as("div")
      .input(z.object({ count: z.number().default(0) }))
      .child(({ count }) => String(count))
      .watch(store, (s) => ({ count: s.count }))
      .mount(el, events);

    store.setState({ count: 5 });
    expect(el.innerHTML).toBe("<div>5</div>");
  });

  it("does NOT re-render when an unrelated slice changes", () => {
    const store = createStore({ count: 0, name: "Ada" });
    const { events } = makeEvents();
    const el = makeEl();

    let renderCount = 0;
    pose
      .as("div")
      .input(z.object({ count: z.number().default(0) }))
      .child(({ count }) => {
        renderCount++;
        return String(count);
      })
      .watch(store, (s) => ({ count: s.count }))
      .mount(el, events);

    const countBefore = renderCount;
    store.setState({ name: "Grace" }); // count unchanged — selector returns same value
    expect(renderCount).toBe(countBefore);
  });

  it("reflects multiple sequential state changes", () => {
    const store = createStore({ count: 0 });
    const { events } = makeEvents();
    const el = makeEl();

    pose
      .as("div")
      .input(z.object({ count: z.number().default(0) }))
      .child(({ count }) => String(count))
      .watch(store, (s) => ({ count: s.count }))
      .mount(el, events);

    for (let i = 1; i <= 5; i++) store.setState({ count: i });
    expect(el.innerHTML).toBe("<div>5</div>");
  });
});

// ---------------------------------------------------------------------------
// .watch() — initial props from store
// ---------------------------------------------------------------------------

describe(".watch() — initial props from store", () => {
  it("uses store state as initial props at mount time", () => {
    const store = createStore({ count: 7 });
    const { events } = makeEvents();
    const el = makeEl();

    pose
      .as("div")
      .input(z.object({ count: z.number().default(0) }))
      .child(({ count }) => String(count))
      .watch(store, (s) => ({ count: s.count }))
      .mount(el, events);

    // Initial render should reflect store's current value, not schema default
    expect(el.innerHTML).toBe("<div>7</div>");
  });

  it("caller-supplied mount props are overridden by store state", () => {
    const store = createStore({ count: 42 });
    const { events } = makeEvents();
    const el = makeEl();

    pose
      .as("div")
      .input(z.object({ count: z.number().default(0) }))
      .child(({ count }) => String(count))
      .watch(store, (s) => ({ count: s.count }))
      .mount(el, events, { count: 1 }); // store value (42) wins

    expect(el.innerHTML).toBe("<div>42</div>");
  });
});

// ---------------------------------------------------------------------------
// .watch() — schema integration
// ---------------------------------------------------------------------------

describe(".watch() — schema integration", () => {
  it("applies schema transforms on re-render", () => {
    const store = createStore({ name: "  ada  " });
    const { events } = makeEvents();
    const el = makeEl();

    pose
      .as("div")
      .input(z.object({ name: z.string().trim() }))
      .child(({ name }) => name)
      .watch(store, (s) => ({ name: s.name }))
      .mount(el, events);

    store.setState({ name: "  grace  " });
    expect(el.innerHTML).toBe("<div>grace</div>");
  });
});

// ---------------------------------------------------------------------------
// .watch() — cleanup / unmount
// ---------------------------------------------------------------------------

describe(".watch() — cleanup", () => {
  it("stops re-rendering after unmount", () => {
    const store = createStore({ count: 0 });
    const { events } = makeEvents();
    const el = makeEl();

    const cleanup = pose
      .as("div")
      .input(z.object({ count: z.number().default(0) }))
      .child(({ count }) => String(count))
      .watch(store, (s) => ({ count: s.count }))
      .mount(el, events);

    store.setState({ count: 1 });
    expect(el.innerHTML).toBe("<div>1</div>");

    cleanup();

    store.setState({ count: 99 });
    expect(el.innerHTML).toBe("<div>1</div>"); // frozen after cleanup
  });

  it("calls events.mount() teardown on cleanup", () => {
    const store = createStore({ count: 0 });
    const { events, unmount } = makeEvents();
    const el = makeEl();

    const cleanup = pose
      .as("div")
      .input(z.object({ count: z.number().default(0) }))
      .child(({ count }) => String(count))
      .watch(store, (s) => ({ count: s.count }))
      .mount(el, events);

    cleanup();
    expect(unmount).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — calling cleanup twice does not throw", () => {
    const store = createStore({ count: 0 });
    const { events } = makeEvents();
    const el = makeEl();

    const cleanup = pose
      .as("div")
      .input(z.object({ count: z.number().default(0) }))
      .child(({ count }) => String(count))
      .watch(store, (s) => ({ count: s.count }))
      .mount(el, events);

    expect(() => {
      cleanup();
      cleanup();
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// .watch() — multiple stores
// ---------------------------------------------------------------------------

describe(".watch() — multiple stores", () => {
  it("re-renders when the first watched store changes", () => {
    const countStore = createStore({ count: 0 });
    const nameStore = createStore({ name: "Ada" });
    const { events } = makeEvents();
    const el = makeEl();

    pose
      .as("div")
      .input(z.object({ count: z.number().default(0), name: z.string().default("") }))
      .child(({ count, name }) => `${name}:${count}`)
      .watch(countStore, (s) => ({ count: s.count }))
      .watch(nameStore, (s) => ({ name: s.name }))
      .mount(el, events);

    countStore.setState({ count: 3 });
    expect(el.innerHTML).toBe("<div>Ada:3</div>");
  });

  it("re-renders when the second watched store changes", () => {
    const countStore = createStore({ count: 0 });
    const nameStore = createStore({ name: "Ada" });
    const { events } = makeEvents();
    const el = makeEl();

    pose
      .as("div")
      .input(z.object({ count: z.number().default(0), name: z.string().default("") }))
      .child(({ count, name }) => `${name}:${count}`)
      .watch(countStore, (s) => ({ count: s.count }))
      .watch(nameStore, (s) => ({ name: s.name }))
      .mount(el, events);

    nameStore.setState({ name: "Grace" });
    expect(el.innerHTML).toBe("<div>Grace:0</div>");
  });

  it("renders with initial state from both stores", () => {
    const countStore = createStore({ count: 10 });
    const nameStore = createStore({ name: "Ada" });
    const { events } = makeEvents();
    const el = makeEl();

    pose
      .as("div")
      .input(z.object({ count: z.number().default(0), name: z.string().default("") }))
      .child(({ count, name }) => `${name}:${count}`)
      .watch(countStore, (s) => ({ count: s.count }))
      .watch(nameStore, (s) => ({ name: s.name }))
      .mount(el, events);

    expect(el.innerHTML).toBe("<div>Ada:10</div>");
  });

  it("tears down all subscriptions on cleanup", () => {
    const countStore = createStore({ count: 0 });
    const nameStore = createStore({ name: "Ada" });
    const { events } = makeEvents();
    const el = makeEl();

    const cleanup = pose
      .as("div")
      .input(z.object({ count: z.number().default(0), name: z.string().default("") }))
      .child(({ count, name }) => `${name}:${count}`)
      .watch(countStore, (s) => ({ count: s.count }))
      .watch(nameStore, (s) => ({ name: s.name }))
      .mount(el, events);

    const htmlBeforeCleanup = el.innerHTML;
    cleanup();

    countStore.setState({ count: 99 });
    nameStore.setState({ name: "Turing" });

    expect(el.innerHTML).toBe(htmlBeforeCleanup); // frozen
  });
});

// ---------------------------------------------------------------------------
// .watch() + .on() — delegated events and reactive state together
// ---------------------------------------------------------------------------

describe(".watch() + .on()", () => {
  it("click increments count and watch fires re-render", () => {
    const store = createStore({ count: 0 }, (set) => ({
      increment: () => set((s) => ({ count: s.count + 1 })),
    }));

    const { events } = makeEvents();
    const realEl = document.createElement("div");

    pose
      .as("div")
      .input(z.object({ count: z.number().default(0) }))
      .child(({ count }) => `<span>${count}</span><button id="inc">+</button>`)
      .on("#inc", "click", () => store.getState().increment())
      .watch(store, (s) => ({ count: s.count }))
      .mount(realEl, events);

    expect(realEl.innerHTML).toContain("<span>0</span>");

    realEl.querySelector("#inc")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(realEl.innerHTML).toContain("<span>1</span>");
  });
});

// ---------------------------------------------------------------------------
// .watch() — callable as a Component (renders to HTML string)
// ---------------------------------------------------------------------------

describe(".watch() — callable", () => {
  it("can be called directly to render an HTML string", () => {
    const store = createStore({ count: 0 });

    const component = pose
      .as("span")
      .input(z.object({ count: z.number().default(0) }))
      .child(({ count }) => String(count))
      .watch(store, (s) => ({ count: s.count }));

    expect(typeof component).toBe("function");
    expect(component({ count: 42 })).toBe("<span>42</span>");
  });

  it("can be nested as a child of another PoseElement", () => {
    const store = createStore({ count: 0 });

    const inner = pose
      .as("span")
      .input(z.object({ count: z.number().default(0) }))
      .child(({ count }) => String(count))
      .watch(store, (s) => ({ count: s.count }));

    const outer = pose.as("div").child(inner);

    expect(outer({ count: 3 })).toBe("<div><span>3</span></div>");
  });
});
