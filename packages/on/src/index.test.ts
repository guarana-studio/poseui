import { it, expect, describe, beforeEach, mock } from "bun:test";
import { createEventMap } from "./index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal DOM subtree from an HTML string and return the root div. */
function fixture(html: string): HTMLDivElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

/** Fire a real DOM event on an element. */
function fire(el: Element, type: string): void {
  el.dispatchEvent(new Event(type, { bubbles: true }));
}

/** Clean up all fixture elements appended during a test. */
function cleanup(): void {
  document.body.innerHTML = "";
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// createEventMap()
// ---------------------------------------------------------------------------

describe("createEventMap()", () => {
  it("returns an object with target, targets, and mount", () => {
    const events = createEventMap();
    expect(typeof events.target).toBe("function");
    expect(typeof events.targets).toBe("function");
    expect(typeof events.mount).toBe("function");
  });

  it("creates independent instances — no shared state", () => {
    const a = createEventMap();
    const b = createEventMap();
    const handler = mock(() => {});

    const root = fixture(`<button id="btn">click</button>`);
    a.target<HTMLButtonElement>("#btn").on("click", handler);

    // mount only a — b has no registrations
    a.mount(root);
    b.mount(root);

    fire(root.querySelector("#btn")!, "click");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// .target()
// ---------------------------------------------------------------------------

describe(".target()", () => {
  it("attaches a listener to the matched element", () => {
    const events = createEventMap();
    const handler = mock(() => {});
    const root = fixture(`<button id="btn">click me</button>`);

    events.target<HTMLButtonElement>("#btn").on("click", handler);
    events.mount(root);

    fire(root.querySelector("#btn")!, "click");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the selector matches nothing", () => {
    const events = createEventMap();
    const handler = mock(() => {});
    const root = fixture(`<div></div>`);

    events.target<HTMLButtonElement>("#nonexistent").on("click", handler);
    // should not throw
    expect(() => events.mount(root)).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it("only matches the first element when multiple exist", () => {
    const events = createEventMap();
    const handler = mock(() => {});
    const root = fixture(`
      <button class="btn">first</button>
      <button class="btn">second</button>
    `);

    events.target<HTMLButtonElement>(".btn").on("click", handler);
    events.mount(root);

    const buttons = root.querySelectorAll(".btn");
    fire(buttons[0]!, "click");
    fire(buttons[1]!, "click");

    // Only the first matched element gets the listener
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("passes the correct currentTarget in the event", () => {
    const events = createEventMap();
    let captured: HTMLButtonElement | null = null;
    const root = fixture(`<button id="btn">click</button>`);

    events.target<HTMLButtonElement>("#btn").on("click", (e) => {
      captured = e.currentTarget;
    });
    events.mount(root);

    fire(root.querySelector("#btn")!, "click");

    expect(captured!).toBe(root.querySelector("#btn")!);
  });

  it("supports multiple event types on the same target", () => {
    const events = createEventMap();
    const clickHandler = mock(() => {});
    const mouseenterHandler = mock(() => {});
    const root = fixture(`<button id="btn">hover/click</button>`);

    events
      .target<HTMLButtonElement>("#btn")
      .on("click", clickHandler)
      .on("mouseenter", mouseenterHandler);
    events.mount(root);

    const btn = root.querySelector("#btn")!;
    fire(btn, "click");
    fire(btn, "mouseenter");

    expect(clickHandler).toHaveBeenCalledTimes(1);
    expect(mouseenterHandler).toHaveBeenCalledTimes(1);
  });

  it("supports multiple .target() calls for different selectors", () => {
    const events = createEventMap();
    const btnHandler = mock(() => {});
    const inputHandler = mock(() => {});
    const root = fixture(`
      <button id="btn">click</button>
      <input id="field" />
    `);

    events.target<HTMLButtonElement>("#btn").on("click", btnHandler);
    events.target<HTMLInputElement>("#field").on("input", inputHandler);
    events.mount(root);

    fire(root.querySelector("#btn")!, "click");
    fire(root.querySelector("#field")!, "input");

    expect(btnHandler).toHaveBeenCalledTimes(1);
    expect(inputHandler).toHaveBeenCalledTimes(1);
  });

  it("is chainable — .on() returns the same handle", () => {
    const events = createEventMap();
    const handle = events.target<HTMLButtonElement>("#btn");
    expect(handle.on("click", () => {})).toBe(handle);
  });
});

// ---------------------------------------------------------------------------
// .targets()
// ---------------------------------------------------------------------------

describe(".targets()", () => {
  it("attaches a listener to all matched elements", () => {
    const events = createEventMap();
    const handler = mock(() => {});
    const root = fixture(`
      <li class="item">a</li>
      <li class="item">b</li>
      <li class="item">c</li>
    `);

    events.targets<HTMLLIElement>(".item").on("click", handler);
    events.mount(root);

    root.querySelectorAll(".item").forEach((el) => fire(el, "click"));
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("does nothing when selector matches nothing", () => {
    const events = createEventMap();
    const handler = mock(() => {});
    const root = fixture(`<div></div>`);

    events.targets<HTMLLIElement>(".item").on("click", handler);
    expect(() => events.mount(root)).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes the correct currentTarget for each element", () => {
    const events = createEventMap();
    const captured: Element[] = [];
    const root = fixture(`
      <li class="item">a</li>
      <li class="item">b</li>
    `);

    events.targets<HTMLLIElement>(".item").on("click", (e) => {
      captured.push(e.currentTarget);
    });
    events.mount(root);

    const items = root.querySelectorAll(".item");
    fire(items[0]!, "click");
    fire(items[1]!, "click");

    expect(captured[0]).toBe(items[0]);
    expect(captured[1]).toBe(items[1]);
  });

  it("handles a single match the same as .target()", () => {
    const events = createEventMap();
    const handler = mock(() => {});
    const root = fixture(`<li class="item">only</li>`);

    events.targets<HTMLLIElement>(".item").on("click", handler);
    events.mount(root);

    fire(root.querySelector(".item")!, "click");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// .off()
// ---------------------------------------------------------------------------

describe(".off()", () => {
  it("removes a registered listener before mount", () => {
    const events = createEventMap();
    const handler = mock(() => {});
    const root = fixture(`<button id="btn">click</button>`);

    const handle = events.target<HTMLButtonElement>("#btn");
    handle.on("click", handler);
    handle.off("click", handler);
    events.mount(root);

    fire(root.querySelector("#btn")!, "click");
    expect(handler).not.toHaveBeenCalled();
  });

  it("only removes the specified listener — others remain", () => {
    const events = createEventMap();
    const handlerA = mock(() => {});
    const handlerB = mock(() => {});
    const root = fixture(`<button id="btn">click</button>`);

    const handle = events.target<HTMLButtonElement>("#btn");
    handle.on("click", handlerA);
    handle.on("click", handlerB);
    handle.off("click", handlerA);
    events.mount(root);

    fire(root.querySelector("#btn")!, "click");
    expect(handlerA).not.toHaveBeenCalled();
    expect(handlerB).toHaveBeenCalledTimes(1);
  });

  it("does nothing when removing a listener that was never registered", () => {
    const events = createEventMap();
    const handler = mock(() => {});
    const root = fixture(`<button id="btn">click</button>`);

    const handle = events.target<HTMLButtonElement>("#btn");
    // off without a prior on — should not throw
    expect(() => handle.off("click", handler)).not.toThrow();
    events.mount(root);

    fire(root.querySelector("#btn")!, "click");
    expect(handler).not.toHaveBeenCalled();
  });

  it("is chainable — .off() returns the same handle", () => {
    const events = createEventMap();
    const handler = mock(() => {});
    const handle = events.target<HTMLButtonElement>("#btn");
    handle.on("click", handler);
    expect(handle.off("click", handler)).toBe(handle);
  });
});

// ---------------------------------------------------------------------------
// .mount()
// ---------------------------------------------------------------------------

describe(".mount()", () => {
  it("returns a cleanup function", () => {
    const events = createEventMap();
    const root = fixture(`<button id="btn">click</button>`);
    const unmount = events.mount(root);
    expect(typeof unmount).toBe("function");
  });

  it("defaults to document when no root is provided", () => {
    const events = createEventMap();
    const handler = mock(() => {});
    // append directly to body — no scoped root
    const btn = document.createElement("button");
    btn.id = "global-btn";
    document.body.appendChild(btn);

    events.target<HTMLButtonElement>("#global-btn").on("click", handler);
    const unmount = events.mount(); // no root argument

    fire(btn, "click");
    expect(handler).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("only matches elements within the provided root", () => {
    const events = createEventMap();
    const handler = mock(() => {});

    // Two buttons with the same selector — one inside root, one outside
    const outside = document.createElement("button");
    outside.className = "btn";
    document.body.appendChild(outside);

    const root = fixture(`<button class="btn">inside</button>`);

    events.target<HTMLButtonElement>(".btn").on("click", handler);
    events.mount(root); // scoped to root only

    fire(outside, "click"); // should not trigger
    fire(root.querySelector(".btn")!, "click"); // should trigger

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("can be called multiple times — each returns an independent cleanup", () => {
    const events = createEventMap();
    const handler = mock(() => {});

    const rootA = fixture(`<button class="btn">A</button>`);
    const rootB = fixture(`<button class="btn">B</button>`);

    events.target<HTMLButtonElement>(".btn").on("click", handler);

    const unmountA = events.mount(rootA);
    const unmountB = events.mount(rootB);

    fire(rootA.querySelector(".btn")!, "click");
    fire(rootB.querySelector(".btn")!, "click");
    expect(handler).toHaveBeenCalledTimes(2);

    // Unmount A only — B's listener should survive
    unmountA();
    fire(rootA.querySelector(".btn")!, "click");
    fire(rootB.querySelector(".btn")!, "click");
    expect(handler).toHaveBeenCalledTimes(3); // only B fires
  });

  it("does not query the DOM until mount() is called", () => {
    const events = createEventMap();
    const handler = mock(() => {});

    // Register before the DOM element exists
    events.target<HTMLButtonElement>("#late-btn").on("click", handler);

    // Now create the element
    const root = fixture(`<button id="late-btn">late</button>`);

    // Should find it now
    events.mount(root);
    fire(root.querySelector("#late-btn")!, "click");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// unmount (cleanup)
// ---------------------------------------------------------------------------

describe("unmount()", () => {
  it("removes all attached listeners", () => {
    const events = createEventMap();
    const handler = mock(() => {});
    const root = fixture(`<button id="btn">click</button>`);

    events.target<HTMLButtonElement>("#btn").on("click", handler);
    const unmount = events.mount(root);

    fire(root.querySelector("#btn")!, "click");
    expect(handler).toHaveBeenCalledTimes(1);

    unmount();
    fire(root.querySelector("#btn")!, "click");
    expect(handler).toHaveBeenCalledTimes(1); // no additional calls
  });

  it("removes listeners across all targets", () => {
    const events = createEventMap();
    const btnHandler = mock(() => {});
    const inputHandler = mock(() => {});
    const root = fixture(`
      <button id="btn">click</button>
      <input id="field" />
    `);

    events.target<HTMLButtonElement>("#btn").on("click", btnHandler);
    events.target<HTMLInputElement>("#field").on("input", inputHandler);
    const unmount = events.mount(root);

    unmount();
    fire(root.querySelector("#btn")!, "click");
    fire(root.querySelector("#field")!, "input");

    expect(btnHandler).not.toHaveBeenCalled();
    expect(inputHandler).not.toHaveBeenCalled();
  });

  it("removes listeners across all elements for .targets()", () => {
    const events = createEventMap();
    const handler = mock(() => {});
    const root = fixture(`
      <li class="item">a</li>
      <li class="item">b</li>
      <li class="item">c</li>
    `);

    events.targets<HTMLLIElement>(".item").on("click", handler);
    const unmount = events.mount(root);

    unmount();
    root.querySelectorAll(".item").forEach((el) => fire(el, "click"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("is idempotent — calling unmount() twice does not throw", () => {
    const events = createEventMap();
    const root = fixture(`<button id="btn">click</button>`);
    events.target<HTMLButtonElement>("#btn").on("click", () => {});
    const unmount = events.mount(root);

    expect(() => {
      unmount();
      unmount();
    }).not.toThrow();
  });

  it("does not affect other active mount instances", () => {
    const events = createEventMap();
    const handler = mock(() => {});
    const rootA = fixture(`<button class="btn">A</button>`);
    const rootB = fixture(`<button class="btn">B</button>`);

    events.target<HTMLButtonElement>(".btn").on("click", handler);
    const unmountA = events.mount(rootA);
    events.mount(rootB); // intentionally not captured — stays mounted

    unmountA();

    fire(rootA.querySelector(".btn")!, "click"); // cleaned up
    fire(rootB.querySelector(".btn")!, "click"); // still active

    expect(handler).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("handles an event map with no registered targets gracefully", () => {
    const events = createEventMap();
    const root = fixture(`<div></div>`);
    expect(() => events.mount(root)).not.toThrow();
  });

  it("handles targets with no .on() calls", () => {
    const events = createEventMap();
    const root = fixture(`<button id="btn">click</button>`);
    events.target<HTMLButtonElement>("#btn"); // no .on() calls
    expect(() => events.mount(root)).not.toThrow();
  });

  it("same handler registered twice fires once — addEventListener deduplicates identical (element, type, fn) triples", () => {
    const events = createEventMap();
    const handler = mock(() => {});
    const root = fixture(`<button id="btn">click</button>`);

    events.target<HTMLButtonElement>("#btn").on("click", handler).on("click", handler); // same reference — browser silently deduplicates
    events.mount(root);

    fire(root.querySelector("#btn")!, "click");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("works with nested selectors inside a scoped root", () => {
    const events = createEventMap();
    const handler = mock(() => {});
    const root = fixture(`
      <form>
        <fieldset>
          <button type="submit">Submit</button>
        </fieldset>
      </form>
    `);

    events.target<HTMLButtonElement>("form fieldset button").on("click", handler);
    events.mount(root);

    fire(root.querySelector("button")!, "click");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("works with SVGElement targets", () => {
    const events = createEventMap();
    const handler = mock(() => {});
    const root = fixture(`<svg><circle id="dot" r="10" cx="50" cy="50" /></svg>`);

    events.target<SVGCircleElement>("#dot").on("click", handler);
    events.mount(root);

    fire(root.querySelector("#dot")!, "click");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
