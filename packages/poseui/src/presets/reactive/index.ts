// =============================================================================
// @poseui/reactive — .watch() preset for poseui
//
// Adds a `.watch(store, selector)` method to every PoseElement. When the
// component is mounted, it subscribes to the selected slice of state and
// calls render() automatically whenever it changes — no .handler() boilerplate
// needed for purely reactive components.
//
// Setup:
//   import { createPose }  from "poseui";
//   import { reactive }    from "poseui/presets/reactive";
//
//   const pose = createPose({ presets: [reactive] });
//
// Usage:
//   const counter = pose
//     .as("div")
//     .input(z.object({ count: z.number().default(0) }))
//     .child(({ count }) => `<span>${count}</span><button id="inc">+</button>`)
//     .on("#inc", "click", () => store.getState().increment())
//     .watch(store, (s) => ({ count: s.count }));
//
//   counter.mount(document.querySelector("#app")!, createEventMap());
// =============================================================================

import type { PoseElement, Component, EventMap, Preset, StandardSchemaV1 } from "poseui";

// ---------------------------------------------------------------------------
// Minimal store interface
// ---------------------------------------------------------------------------

export interface WatchableStore<TState extends object> {
  getState(): TState;
  subscribe<S>(selector: (state: TState) => S, listener: (slice: S, prev: S) => void): () => void;
}

// ---------------------------------------------------------------------------
// WatchableComponent
//
// A Component that also exposes .watch() so chaining works at the type level:
//   pose.as("div").watch(storeA, ...).watch(storeB, ...)
// ---------------------------------------------------------------------------

export interface WatchableComponent<
  TProps extends Record<string, unknown>,
  TSchema extends StandardSchemaV1 | undefined,
  TEvents extends EventMap,
> extends Component<TProps, TSchema, TEvents> {
  watch<TState extends object>(
    store: WatchableStore<TState>,
    selector: (state: TState) => Partial<TProps>,
  ): WatchableComponent<TProps, TSchema, TEvents>;
}

// ---------------------------------------------------------------------------
// WatchEntry
// ---------------------------------------------------------------------------

type WatchEntry = {
  store: WatchableStore<any>;
  selector: (state: any) => Record<string, unknown>;
};

const watchRegistry = new WeakMap<object, WatchEntry[]>();

function getEntries(el: object): WatchEntry[] {
  return watchRegistry.get(el) ?? [];
}

// ---------------------------------------------------------------------------
// mergeFromStores
// ---------------------------------------------------------------------------

function mergeFromStores(entries: WatchEntry[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const { store, selector } of entries) {
    Object.assign(merged, selector(store.getState()));
  }
  return merged;
}

// ---------------------------------------------------------------------------
// buildWatchedComponent
// ---------------------------------------------------------------------------

function buildWatchedComponent<
  TProps extends Record<string, unknown>,
  TSchema extends StandardSchemaV1 | undefined,
  TEvents extends EventMap,
>(
  base: PoseElement<TProps, TSchema, any>,
  entries: WatchEntry[],
): WatchableComponent<TProps, TSchema, TEvents> {
  // Callable — renders to an HTML string like any PoseElement.
  function component(...args: any[]): any {
    return (base as any)(...args);
  }

  component.mount = function (rootEl: Element, events: TEvents, ...args: any[]): () => void {
    const callerProps = (args[0] ?? {}) as Partial<TProps>;
    const initialProps = { ...callerProps, ...mergeFromStores(entries) };

    const baseComponent = (base as any).handler(({ render }: { render: (p: any) => void }) => {
      // Wrap selector in JSON.stringify so store.subscribe gets a stable
      // scalar. Object.is("{"count":0}", "{"count":0}") === true, so the
      // subscription only fires when the serialised slice actually changes —
      // unrelated state changes produce the same string and are ignored.
      const unsubs = entries.map(({ store, selector }) =>
        store.subscribe(
          (state: any) => JSON.stringify(selector(state)),
          () => {
            render(mergeFromStores(entries));
          },
        ),
      );

      return () => {
        for (const unsub of unsubs) unsub();
      };
    });

    return baseComponent.mount(rootEl, events, initialProps);
  };

  (component as any).__pose = true;
  (component as any).__state = (base as any).__state;

  // Attach .watch() so chaining returns another WatchableComponent.
  attachWatch(component as any, base, entries);

  return component as unknown as WatchableComponent<TProps, TSchema, TEvents>;
}

// ---------------------------------------------------------------------------
// attachWatch — attach .watch() onto a WatchableComponent for chaining
// ---------------------------------------------------------------------------

function attachWatch<
  TProps extends Record<string, unknown>,
  TSchema extends StandardSchemaV1 | undefined,
>(
  component: WatchableComponent<TProps, TSchema, any>,
  base: PoseElement<TProps, TSchema, any>,
  currentEntries: WatchEntry[],
): void {
  (component as any).watch = function <TState extends object>(
    store: WatchableStore<TState>,
    selector: (state: TState) => Partial<TProps>,
  ): WatchableComponent<TProps, TSchema, any> {
    const nextEntries: WatchEntry[] = [
      ...currentEntries,
      { store, selector: selector as (state: any) => Record<string, unknown> },
    ];
    const nextComponent = buildWatchedComponent(base, nextEntries);
    watchRegistry.set(nextComponent as any, nextEntries);
    return nextComponent;
  };
}

// ---------------------------------------------------------------------------
// Declaration merging
// ---------------------------------------------------------------------------

declare module "poseui" {
  interface PoseElement<TProps extends Record<string, unknown>, TSchema, TTag extends string> {
    /**
     * Subscribe to a store slice and re-render the component whenever it
     * changes. The selector maps store state to a partial of the component's
     * props — only the returned keys are updated on each re-render.
     *
     * Returns a `WatchableComponent` — mountable, still callable as an HTML
     * string, and chainable with further `.watch()` calls for multiple stores.
     *
     * The selector result is compared by serialised value, so re-renders only
     * fire when the selected content actually changes. On initial mount,
     * current store state is read and used as props.
     *
     * @example
     * pose
     *   .as("div")
     *   .input(z.object({ count: z.number().default(0) }))
     *   .child(({ count }) => `<span>${count}</span><button id="inc">+</button>`)
     *   .on("#inc", "click", () => store.getState().increment())
     *   .watch(store, (s) => ({ count: s.count }));
     *
     * @example — multiple stores
     * pose
     *   .as("div")
     *   .input(z.object({ count: z.number().default(0), name: z.string().default("") }))
     *   .child(({ count, name }) => `${name}: ${count}`)
     *   .watch(countStore, (s) => ({ count: s.count }))
     *   .watch(userStore,  (s) => ({ name: s.user?.name ?? "" }));
     */
    watch<TState extends object>(
      store: WatchableStore<TState>,
      selector: (state: TState) => Partial<TProps>,
    ): WatchableComponent<TProps, TSchema, EventMap>;
  }
}

// ---------------------------------------------------------------------------
// Preset
// ---------------------------------------------------------------------------

export const reactive: Preset<PoseElement<any, any, any>> = {
  name: "reactive",

  extend(el) {
    el.watch = function <TState extends object>(
      store: WatchableStore<TState>,
      selector: (state: TState) => Record<string, unknown>,
    ): WatchableComponent<any, any, any> {
      const entries: WatchEntry[] = [...getEntries(el), { store, selector }];
      const component = buildWatchedComponent(el, entries);
      watchRegistry.set(component as any, entries);
      return component;
    };
  },
};
