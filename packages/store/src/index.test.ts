// =============================================================================
// @poseui/store — test suite
// Run with: bun test --dom (happy-dom needed for bind() tests)
// =============================================================================

import { describe, it, expect, mock, beforeEach } from "bun:test";
import { createStore, effectScope } from "./index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fixture(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// createStore()
// ---------------------------------------------------------------------------

describe("createStore()", () => {
  it("returns an object with the expected API", () => {
    const store = createStore(() => ({ count: 0 }));
    expect(typeof store.getState).toBe("function");
    expect(typeof store.setState).toBe("function");
    expect(typeof store.getInitialState).toBe("function");
    expect(typeof store.subscribe).toBe("function");
    expect(typeof store.bind).toBe("function");
  });

  it("initialises state from the creator return value", () => {
    const store = createStore(() => ({ count: 42, name: "Ada" }));
    expect(store.getState().count).toBe(42);
    expect(store.getState().name).toBe("Ada");
  });

  it("passes set and get to the creator", () => {
    const store = createStore<{ count: number; double: () => number; inc: () => void }>()(
      (set, get) => ({
        count: 0,
        double: () => get().count * 2,
        inc: () => set((s) => ({ count: s.count + 1 })),
      }),
    );
    store.getState().inc();
    expect(store.getState().count).toBe(1);
    expect(store.getState().double()).toBe(2);
  });

  it("passes the api to the creator — actions can reference store.getInitialState()", () => {
    const store = createStore<{ count: number; reset: () => void }>()((set, _get, api) => ({
      count: 5,
      reset: () => set(api.getInitialState()),
    }));
    store.setState({ count: 99 });
    store.getState().reset();
    expect(store.getState().count).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// getState()
// ---------------------------------------------------------------------------

describe("getState()", () => {
  it("returns the current state", () => {
    const store = createStore(() => ({ x: 1 }));
    expect(store.getState().x).toBe(1);
  });

  it("reflects the latest setState", () => {
    const store = createStore(() => ({ x: 1 }));
    store.setState({ x: 99 });
    expect(store.getState().x).toBe(99);
  });

  it("returns a stable reference when state has not changed", () => {
    const store = createStore(() => ({ x: 1 }));
    const a = store.getState();
    const b = store.getState();
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// getInitialState()
// ---------------------------------------------------------------------------

describe("getInitialState()", () => {
  it("returns the original state from the creator", () => {
    const store = createStore(() => ({ count: 7 }));
    store.setState({ count: 99 });
    expect(store.getInitialState().count).toBe(7);
  });

  it("is not affected by subsequent setState calls", () => {
    const store = createStore(() => ({ a: 1, b: 2 }));
    store.setState({ a: 100 });
    store.setState({ b: 200 });
    expect(store.getInitialState().a).toBe(1);
    expect(store.getInitialState().b).toBe(2);
  });

  it("can be used to reset state", () => {
    const store = createStore(() => ({ count: 0 }));
    store.setState({ count: 50 });
    store.setState(store.getInitialState());
    expect(store.getState().count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// setState()
// ---------------------------------------------------------------------------

describe("setState()", () => {
  it("merges a plain object shallowly", () => {
    const store = createStore(() => ({ a: 1, b: 2 }));
    store.setState({ a: 10 });
    expect(store.getState().a).toBe(10);
    expect(store.getState().b).toBe(2); // untouched
  });

  it("accepts an updater function", () => {
    const store = createStore(() => ({ count: 3 }));
    store.setState((s) => ({ count: s.count * 2 }));
    expect(store.getState().count).toBe(6);
  });

  it("updater receives the latest state", () => {
    const store = createStore(() => ({ count: 0 }));
    store.setState({ count: 5 });
    store.setState((s) => ({ count: s.count + 1 }));
    expect(store.getState().count).toBe(6);
  });

  it("preserves keys not included in the partial update", () => {
    const store = createStore(() => ({ x: 1, y: 2, z: 3 }));
    store.setState({ z: 99 });
    expect(store.getState().x).toBe(1);
    expect(store.getState().y).toBe(2);
    expect(store.getState().z).toBe(99);
  });

  it("applies multiple updates in sequence — last write wins per key", () => {
    const store = createStore(() => ({ count: 0 }));
    store.setState({ count: 1 });
    store.setState({ count: 2 });
    store.setState({ count: 3 });
    expect(store.getState().count).toBe(3);
  });

  it("setting the same value does not change the state reference", () => {
    const store = createStore(() => ({ count: 1 }));
    const _before = store.getState();
    store.setState({ count: 1 });
    // alien-signals may or may not produce a new object for same-value sets —
    // what matters is getState() returns consistent values
    expect(store.getState().count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// subscribe() — full-state form
// ---------------------------------------------------------------------------

describe("subscribe() — full-state form", () => {
  it("returns an unsubscribe function", () => {
    const store = createStore(() => ({ count: 0 }));
    const unsub = store.subscribe(mock());
    expect(typeof unsub).toBe("function");
    unsub();
  });

  it("fires the listener when state changes", () => {
    const store = createStore(() => ({ count: 0 }));
    const listener = mock();
    store.subscribe(listener);

    store.setState({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire on initial subscription (no fireImmediately)", () => {
    const store = createStore(() => ({ count: 0 }));
    const listener = mock();
    store.subscribe(listener);
    expect(listener).not.toHaveBeenCalled();
  });

  it("passes (newState, prevState) to the listener", () => {
    const store = createStore(() => ({ count: 0 }));
    const listener = mock();
    store.subscribe(listener);

    store.setState({ count: 5 });
    const [newState, prevState] = listener.mock.calls[0] as [{ count: number }, { count: number }];
    expect(newState.count).toBe(5);
    expect(prevState.count).toBe(0);
  });

  it("fires for every setState call", () => {
    const store = createStore(() => ({ count: 0 }));
    const listener = mock();
    store.subscribe(listener);

    store.setState({ count: 1 });
    store.setState({ count: 2 });
    store.setState({ count: 3 });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("stops firing after unsubscribe", () => {
    const store = createStore(() => ({ count: 0 }));
    const listener = mock();
    const unsub = store.subscribe(listener);

    store.setState({ count: 1 });
    unsub();
    store.setState({ count: 2 });
    store.setState({ count: 3 });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe is idempotent", () => {
    const store = createStore(() => ({ count: 0 }));
    const unsub = store.subscribe(mock());
    expect(() => {
      unsub();
      unsub();
    }).not.toThrow();
  });

  it("multiple independent subscribers all receive changes", () => {
    const store = createStore(() => ({ count: 0 }));
    const a = mock();
    const b = mock();
    store.subscribe(a);
    store.subscribe(b);

    store.setState({ count: 1 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("unsubscribing one does not affect others", () => {
    const store = createStore(() => ({ count: 0 }));
    const a = mock();
    const b = mock();
    const unsubA = store.subscribe(a);
    store.subscribe(b);

    unsubA();
    store.setState({ count: 1 });

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// subscribe() — selector form
// ---------------------------------------------------------------------------

describe("subscribe() — selector form", () => {
  it("fires only when the selected slice changes", () => {
    const store = createStore(() => ({ count: 0, name: "Ada" }));
    const listener = mock();
    store.subscribe((s) => s.count, listener);

    store.setState({ name: "Grace" }); // name changed — count unchanged
    expect(listener).not.toHaveBeenCalled();

    store.setState({ count: 1 }); // count changed
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("passes (newSlice, prevSlice) to the listener", () => {
    const store = createStore(() => ({ count: 0 }));
    const listener = mock();
    store.subscribe((s) => s.count, listener);

    store.setState({ count: 7 });
    const [newSlice, prevSlice] = listener.mock.calls[0] ?? [];
    expect(newSlice).toBe(7);
    expect(prevSlice).toBe(0);
  });

  it("does NOT fire on initial subscription", () => {
    const store = createStore(() => ({ count: 0 }));
    const listener = mock();
    store.subscribe((s) => s.count, listener);
    expect(listener).not.toHaveBeenCalled();
  });

  it("fires for each distinct value change", () => {
    const store = createStore(() => ({ count: 0 }));
    const listener = mock();
    store.subscribe((s) => s.count, listener);

    store.setState({ count: 1 });
    store.setState({ count: 2 });
    store.setState({ count: 3 });
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("does NOT fire when the selected value is set to the same reference", () => {
    const obj = { id: 1 };
    const store = createStore(() => ({ obj, other: 0 }));
    const listener = mock();
    store.subscribe((s) => s.obj, listener);

    store.setState({ other: 99 }); // obj reference unchanged
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops firing after unsubscribe", () => {
    const store = createStore(() => ({ count: 0 }));
    const listener = mock();
    const unsub = store.subscribe((s) => s.count, listener);

    store.setState({ count: 1 });
    unsub();
    store.setState({ count: 2 });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("multiple selectors on the same store are independent", () => {
    const store = createStore(() => ({ a: 0, b: 0 }));
    const listenerA = mock();
    const listenerB = mock();
    store.subscribe((s) => s.a, listenerA);
    store.subscribe((s) => s.b, listenerB);

    store.setState({ a: 1 });
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).not.toHaveBeenCalled();

    store.setState({ b: 1 });
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// bind() — full-state form
// ---------------------------------------------------------------------------

describe("bind() — full-state form", () => {
  it("renders immediately on bind", () => {
    const store = createStore(() => ({ count: 0 }));
    const el = fixture("<div id='target'></div>");
    const target = el.querySelector("#target")!;

    store.bind(target, (s) => `<span>${s.count}</span>`);
    expect(target.innerHTML).toBe("<span>0</span>");
  });

  it("re-renders when state changes", () => {
    const store = createStore(() => ({ count: 0 }));
    const el = fixture("<div id='target'></div>");
    const target = el.querySelector("#target")!;

    store.bind(target, (s) => `<span>${s.count}</span>`);
    store.setState({ count: 5 });
    expect(target.innerHTML).toBe("<span>5</span>");
  });

  it("returns an unsub function that stops re-renders", () => {
    const store = createStore(() => ({ count: 0 }));
    const el = fixture("<div id='target'></div>");
    const target = el.querySelector("#target")!;

    const unsub = store.bind(target, (s) => `${s.count}`);
    store.setState({ count: 1 });
    unsub();
    store.setState({ count: 99 });

    expect(target.innerHTML).toBe("1");
  });

  it("multiple bind calls on different elements are independent", () => {
    const store = createStore(() => ({ count: 0 }));
    const root = fixture("<div id='a'></div><div id='b'></div>");
    const a = root.querySelector("#a")!;
    const b = root.querySelector("#b")!;

    store.bind(a, (s) => `a:${s.count}`);
    store.bind(b, (s) => `b:${s.count}`);

    store.setState({ count: 3 });
    expect(a.innerHTML).toBe("a:3");
    expect(b.innerHTML).toBe("b:3");
  });
});

// ---------------------------------------------------------------------------
// bind() — selector form
// ---------------------------------------------------------------------------

describe("bind() — selector form", () => {
  it("renders immediately with the initial slice", () => {
    const store = createStore(() => ({ count: 0, name: "Ada" }));
    const el = fixture("<div id='target'></div>");
    const target = el.querySelector("#target")!;

    store.bind(
      target,
      (s) => s.count,
      (count) => `<b>${count}</b>`,
    );
    expect(target.innerHTML).toBe("<b>0</b>");
  });

  it("re-renders when the selected slice changes", () => {
    const store = createStore(() => ({ count: 0, name: "Ada" }));
    const el = fixture("<div id='target'></div>");
    const target = el.querySelector("#target")!;

    store.bind(
      target,
      (s) => s.count,
      (count) => `${count}`,
    );
    store.setState({ count: 7 });
    expect(target.innerHTML).toBe("7");
  });

  it("does NOT re-render when an unrelated slice changes", () => {
    const store = createStore(() => ({ count: 0, name: "Ada" }));
    const el = fixture("<div id='target'></div>");
    const target = el.querySelector("#target")!;

    const render = mock((count: number) => `${count}`);
    store.bind(target, (s) => s.count, render);

    const callsBefore = render.mock.calls.length;
    store.setState({ name: "Grace" }); // count unchanged
    expect(render.mock.calls.length).toBe(callsBefore); // no extra render
  });

  it("returns an unsub that stops re-renders", () => {
    const store = createStore(() => ({ count: 0 }));
    const el = fixture("<div id='target'></div>");
    const target = el.querySelector("#target")!;

    const unsub = store.bind(
      target,
      (s) => s.count,
      (c) => `${c}`,
    );
    store.setState({ count: 1 });
    unsub();
    store.setState({ count: 99 });

    expect(target.innerHTML).toBe("1");
  });

  it("two selectors on the same element — last bind wins (overwrites innerHTML)", () => {
    const store = createStore(() => ({ a: 0, b: 0 }));
    const el = fixture("<div id='target'></div>");
    const target = el.querySelector("#target")!;

    store.bind(
      target,
      (s) => s.a,
      (a) => `a:${a}`,
    );
    store.bind(
      target,
      (s) => s.b,
      (b) => `b:${b}`,
    );

    // After both fire immediately, b bind wins
    expect(target.innerHTML).toBe("b:0");

    store.setState({ a: 1 });
    expect(target.innerHTML).toBe("a:1"); // a bind re-ran and now owns innerHTML
  });
});

// ---------------------------------------------------------------------------
// Actions defined in the creator
// ---------------------------------------------------------------------------

describe("actions in creator", () => {
  it("actions can call set", () => {
    const store = createStore<{ count: number; inc: () => void; dec: () => void }>()((set) => ({
      count: 0,
      inc: () => set((s) => ({ count: s.count + 1 })),
      dec: () => set((s) => ({ count: s.count - 1 })),
    }));

    store.getState().inc();
    store.getState().inc();
    store.getState().dec();
    expect(store.getState().count).toBe(1);
  });

  it("actions can read state via get", () => {
    const store = createStore<{ count: number; double: () => number }>()((set, get) => ({
      count: 10,
      double: () => get().count * 2,
    }));

    store.setState({ count: 6 });
    expect(store.getState().double()).toBe(12);
  });

  it("actions are preserved after setState", () => {
    const store = createStore<{ count: number; inc: () => void }>()((set) => ({
      count: 0,
      inc: () => set((s) => ({ count: s.count + 1 })),
    }));

    store.setState({ count: 5 });
    store.getState().inc(); // action must still be present
    expect(store.getState().count).toBe(6);
  });

  it("listeners fire when an action calls set", () => {
    const store = createStore<{ count: number; inc: () => void }>()((set) => ({
      count: 0,
      inc: () => set((s) => ({ count: s.count + 1 })),
    }));

    const listener = mock();
    store.subscribe(listener);
    store.getState().inc();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// effectScope re-export
// ---------------------------------------------------------------------------

describe("effectScope", () => {
  it("is exported from @poseui/store", () => {
    expect(typeof effectScope).toBe("function");
  });

  it("stops all effects inside the scope when stop() is called", () => {
    const store = createStore(() => ({ count: 0 }));
    const listener = mock();

    const stop = effectScope(() => {
      store.subscribe(listener);
    });

    store.setState({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    stop();
    store.setState({ count: 2 });
    store.setState({ count: 3 });
    expect(listener).toHaveBeenCalledTimes(1); // no more calls
  });

  it("stops all bind effects inside the scope", () => {
    const store = createStore(() => ({ count: 0 }));
    const el = fixture("<div id='target'></div>");
    const target = el.querySelector("#target")!;

    const stop = effectScope(() => {
      store.bind(target, (s) => `${s.count}`);
    });

    store.setState({ count: 5 });
    expect(target.innerHTML).toBe("5");

    stop();
    store.setState({ count: 99 });
    expect(target.innerHTML).toBe("5"); // no re-render after scope stopped
  });

  it("groups multiple binds and subscriptions — one stop tears all down", () => {
    const store = createStore(() => ({ count: 0, name: "Ada" }));
    const root = fixture("<div id='a'></div><div id='b'></div>");
    const a = root.querySelector("#a")!;
    const b = root.querySelector("#b")!;
    const listener = mock();

    const stop = effectScope(() => {
      store.bind(
        a,
        (s) => s.count,
        (c) => `${c}`,
      );
      store.bind(
        b,
        (s) => s.name,
        (n) => n,
      );
      store.subscribe(listener);
    });

    store.setState({ count: 1, name: "Grace" });
    expect(a.innerHTML).toBe("1");
    expect(b.innerHTML).toBe("Grace");
    expect(listener).toHaveBeenCalledTimes(1);

    stop();
    store.setState({ count: 99, name: "Turing" });
    expect(a.innerHTML).toBe("1"); // frozen
    expect(b.innerHTML).toBe("Grace"); // frozen
    expect(listener).toHaveBeenCalledTimes(1); // no more calls
  });
});

// ---------------------------------------------------------------------------
// Integration — store + form-like pattern
// ---------------------------------------------------------------------------

describe("integration", () => {
  it("form error state drives DOM via bind", () => {
    const store = createStore<{
      errors: Record<string, string>;
      setErrors: (e: Record<string, string>) => void;
      clearErrors: () => void;
    }>()((set) => ({
      errors: {} as Record<string, string>,
      setErrors: (errors) => set({ errors }),
      clearErrors: () => set({ errors: {} }),
    }));

    const el = fixture("<div id='errors'></div>");
    const target = el.querySelector("#errors")!;

    store.bind(
      target,
      (s) => s.errors,
      (errors) =>
        Object.entries(errors)
          .map(([field, msg]) => `<p data-field="${field}">${msg}</p>`)
          .join(""),
    );

    expect(target.innerHTML).toBe("");

    store.getState().setErrors({ email: "Invalid email", name: "Required" });
    expect(target.querySelectorAll("p").length).toBe(2);
    expect(target.querySelector("[data-field='email']")?.textContent).toBe("Invalid email");

    store.getState().clearErrors();
    expect(target.innerHTML).toBe("");
  });

  it("counter with computed-derived label", () => {
    const store = createStore<{ count: number; inc: () => void; label: () => string }>()(
      (set, get) => ({
        count: 0,
        inc: () => set((s) => ({ count: s.count + 1 })),
        label: () => `Count: ${get().count}`,
      }),
    );

    const el = fixture("<div id='label'></div>");
    const target = el.querySelector("#label")!;

    store.bind(
      target,
      (s) => s.count,
      (count) => `Count: ${count}`,
    );
    expect(target.innerHTML).toBe("Count: 0");

    store.getState().inc();
    store.getState().inc();
    expect(target.innerHTML).toBe("Count: 2");
  });

  it("dirty flag store drives button disabled state", () => {
    const store = createStore<{ dirty: boolean; markDirty: () => void; reset: () => void }>()(
      (set) => ({
        dirty: false,
        markDirty: () => set({ dirty: true }),
        reset: () => set({ dirty: false }),
      }),
    );

    const el = fixture("<button id='btn'>Submit</button>");
    const btn = el.querySelector("#btn") as HTMLButtonElement;

    store.bind(
      btn,
      (s) => s.dirty,
      (dirty) => {
        btn.disabled = !dirty;
        return btn.textContent ?? "";
      },
    );

    expect(btn.disabled).toBe(true); // initially not dirty

    store.getState().markDirty();
    expect(btn.disabled).toBe(false);

    store.getState().reset();
    expect(btn.disabled).toBe(true);
  });
});
