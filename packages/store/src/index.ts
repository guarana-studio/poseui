// =============================================================================
// @poseui/store — zustand-shaped reactive store backed by alien-signals
//
// Familiar API for anyone coming from zustand/vanilla, with one addition:
// store.bind() closes the loop between state changes and pose re-renders.
// =============================================================================

import { signal, computed, effect, effectScope } from "alien-signals";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Partial state update — either a plain object merged shallowly into state,
 * or an updater function that receives the current state and returns a partial.
 */
export type StateUpdate<T> = Partial<T> | ((state: T) => Partial<T>);

/**
 * The `set` function passed to the state creator. Merges a partial update
 * into the current state.
 */
export type SetState<T> = (update: StateUpdate<T>) => void;

/**
 * The `get` function passed to the state creator. Returns the current state
 * snapshot synchronously.
 */
export type GetState<T> = () => T;

/**
 * A subscriber listening to state changes.
 * Receives the new state and the previous state.
 */
export type Listener<T> = (state: T, prevState: T) => void;

/**
 * A selector subscriber — fires only when the selected slice changes.
 * Receives the new slice and the previous slice.
 */
export type SliceListener<_T, S> = (slice: S, prevSlice: S) => void;

/** Returns an unsubscribe / cleanup function. */
export type Unsub = () => void;

export interface StoreApi<T extends object> {
  /**
   * Merge a partial update into state. Accepts either a plain object or an
   * updater function that receives the current state.
   *
   * @example
   * store.setState({ count: 5 })
   * store.setState((s) => ({ count: s.count + 1 }))
   */
  setState(update: StateUpdate<T>): void;

  /**
   * Read the current state snapshot synchronously.
   */
  getState(): T;

  /**
   * Read the state at the time the store was created.
   * Useful as a reset reference.
   */
  getInitialState(): T;

  /**
   * Subscribe to every state change.
   * The listener receives `(newState, prevState)`.
   * Returns an unsubscribe function.
   *
   * @example
   * const unsub = store.subscribe((state, prev) => {
   *   console.log("count changed from", prev.count, "to", state.count);
   * });
   */
  subscribe(listener: Listener<T>): Unsub;

  /**
   * Subscribe to a selected slice of state.
   * The listener fires only when the selected value changes (by reference).
   * Returns an unsubscribe function.
   *
   * @example
   * const unsub = store.subscribe(
   *   (s) => s.count,
   *   (count, prev) => console.log("count:", count, "was:", prev),
   * );
   */
  subscribe<S>(selector: (state: T) => S, listener: SliceListener<T, S>): Unsub;

  /**
   * Bind a DOM element to a render function — re-renders `el.innerHTML`
   * whenever any state changes.
   *
   * Returns an unsubscribe / cleanup function.
   *
   * @example
   * store.bind(
   *   document.getElementById("counter")!,
   *   (state) => counterEl({ count: state.count }),
   * );
   */
  bind(el: Element, render: (state: T) => string): Unsub;

  /**
   * Bind a DOM element to a selected slice of state — re-renders
   * `el.innerHTML` only when the selected slice changes (by reference).
   *
   * Returns an unsubscribe / cleanup function.
   *
   * @example
   * store.bind(
   *   document.getElementById("user")!,
   *   (s) => s.user,
   *   (user) => userEl({ name: user?.name ?? "Guest" }),
   * );
   */
  bind<S>(el: Element, selector: (state: T) => S, render: (slice: S) => string): Unsub;
}

/**
 * The state creator function passed to `createStore`.
 * Receives `set`, `get`, and the store API itself.
 */
export type StateCreator<T extends object> = (
  set: SetState<T>,
  get: GetState<T>,
  api: StoreApi<T>,
) => T;

/**
 * Curried form of createStore — fixes T first, then takes the creator.
 * Identical to zustand/vanilla's pattern; breaks the set/get circular
 * inference that makes `T` fall back to `object` in the single-call form.
 *
 * @example
 * const store = createStore<{ count: number; inc: () => void }>()((set) => ({
 *   count: 0,
 *   inc: () => set((s) => ({ count: s.count + 1 })),
 * }));
 */
export interface CreateStore {
  <T extends object>(creator: StateCreator<T>): StoreApi<T>;
  <T extends object>(): (creator: StateCreator<T>) => StoreApi<T>;
}

// ---------------------------------------------------------------------------
// createStore
// ---------------------------------------------------------------------------

/**
 * Create a reactive store backed by alien-signals.
 *
 * The API mirrors zustand/vanilla: `getState`, `setState`, `subscribe`, and
 * `getInitialState`. One addition: `bind()` connects a DOM element directly
 * to state changes via a pose render function, eliminating manual `innerHTML`
 * management.
 *
 * @example
 * import { createStore } from "@poseui/store";
 *
 * // Inferred form — no type annotation needed for simple state
 * const counter = createStore(() => ({ count: 0 }));
 *
 * // Curried form — required when state includes actions (breaks circular inference)
 * const store = createStore<{
 *   count: number;
 *   user: User | null;
 *   inc: () => void;
 *   login: (user: User) => void;
 *   reset: () => void;
 * }>()((set, _get, api) => ({
 *   count: 0,
 *   user:  null,
 *   inc:   () => set((s) => ({ count: s.count + 1 })),
 *   login: (user) => set({ user }),
 *   reset: () => set(api.getInitialState()),
 * }));
 *
 * store.subscribe((state, prev) => {
 *   console.log("count:", state.count, "was:", prev.count);
 * });
 *
 * store.bind(
 *   document.getElementById("counter")!,
 *   (s) => s.count,
 *   (count) => counterEl({ count }),
 * );
 *
 * store.getState().inc();
 */
export function createStore<T extends object>(creator: StateCreator<T>): StoreApi<T>;
export function createStore<T extends object>(): (creator: StateCreator<T>) => StoreApi<T>;
export function createStore<T extends object>(creatorOrNothing?: StateCreator<T>) {
  if (creatorOrNothing === undefined) {
    // Curried form: createStore<T>()((set, get, api) => ...)
    return (creator: StateCreator<T>) => createStoreImpl(creator);
  }
  return createStoreImpl(creatorOrNothing);
}

function createStoreImpl<T extends object>(creator: StateCreator<T>): StoreApi<T> {
  // ---------------------------------------------------------------------------
  // Core reactive atom — the entire state lives in a single signal so that
  // `computed` slices derived from it automatically track dependencies.
  // ---------------------------------------------------------------------------

  // We initialise with a placeholder and replace it after the creator runs,
  // so the creator can reference `api` during initialisation.
  let stateSignal = signal<T>({} as T);

  // ---------------------------------------------------------------------------
  // setState — shallow merge, supports updater functions
  // ---------------------------------------------------------------------------

  function setState(update: StateUpdate<T>): void {
    const current = stateSignal();
    const patch = typeof update === "function" ? (update as (s: T) => Partial<T>)(current) : update;
    stateSignal({ ...current, ...patch });
  }

  function getState(): T {
    return stateSignal();
  }

  // ---------------------------------------------------------------------------
  // subscribe — two overloads
  //
  // subscribe(listener)                   → fires on every state change
  // subscribe(selector, listener)         → fires only when slice changes
  //
  // Built on alien-signals' `effect`. Each effect re-runs whenever the signals
  // it read during the previous run have changed. We capture the previous value
  // manually so we can pass (newState, prevState) to the listener.
  // ---------------------------------------------------------------------------

  function subscribe(listener: Listener<T>): Unsub;
  function subscribe<S>(selector: (state: T) => S, listener: SliceListener<T, S>): Unsub;
  function subscribe<S>(
    listenerOrSelector: Listener<T> | ((state: T) => S),
    maybeListener?: SliceListener<T, S>,
  ): Unsub {
    if (maybeListener === undefined) {
      // Full-state form
      const listener = listenerOrSelector as Listener<T>;
      let prev = stateSignal();
      let first = true;

      const stop = effect(() => {
        const current = stateSignal();
        if (first) {
          first = false;
          return;
        }
        listener(current, prev);
        prev = current;
      });

      return stop;
    }

    // Selector form — only fire when the selected slice changes by reference
    const selector = listenerOrSelector as (state: T) => S;
    const sliceListener = maybeListener;

    // Use alien-signals' computed to derive the slice — the effect that reads
    // it will only re-run when the computed output changes.
    const sliceComputed = computed(() => selector(stateSignal()));
    let prevSlice = sliceComputed();
    let first = true;

    const stop = effect(() => {
      const currentSlice = sliceComputed();
      if (first) {
        first = false;
        return;
      }
      if (!Object.is(currentSlice, prevSlice)) {
        sliceListener(currentSlice, prevSlice);
        prevSlice = currentSlice;
      }
    });

    return stop;
  }

  // ---------------------------------------------------------------------------
  // bind — connects a DOM element to state via a pose render function.
  //
  // Renders immediately on call (fire-immediately behaviour), then re-renders
  // whenever the relevant state changes. Two overloads:
  //
  //   bind(el, render)                 → re-renders on any state change
  //   bind(el, selector, render)       → re-renders only when slice changes
  // ---------------------------------------------------------------------------

  function bind(el: Element, render: (state: T) => string): Unsub;
  function bind<S>(el: Element, selector: (state: T) => S, render: (slice: S) => string): Unsub;
  function bind<S>(
    el: Element,
    renderOrSelector: ((state: T) => string) | ((state: T) => S),
    maybeRender?: (slice: S) => string,
  ): Unsub {
    if (maybeRender === undefined) {
      // Full-state form — re-render on any change
      const render = renderOrSelector as (state: T) => string;

      const stop = effect(() => {
        el.innerHTML = render(stateSignal());
      });

      return stop;
    }

    // Selector form — only re-render when the selected slice changes
    const selector = renderOrSelector as (state: T) => S;
    const render = maybeRender;
    const sliceComputed = computed(() => selector(stateSignal()));

    const stop = effect(() => {
      el.innerHTML = render(sliceComputed());
    });

    return stop;
  }

  // ---------------------------------------------------------------------------
  // Assemble the api object before running the creator so actions can
  // close over it (e.g. for reset: `set(store.getInitialState())`).
  // ---------------------------------------------------------------------------

  const api: StoreApi<T> = {
    setState,
    getState,
    getInitialState: () => initialState,
    subscribe,
    bind,
  };

  // Run the creator to get the initial state, then write it into the signal.
  const initialState = creator(setState, getState, api);
  stateSignal(initialState);

  return api;
}

// ---------------------------------------------------------------------------
// effectScope re-export — convenience for grouping store subscriptions and
// bindings so they can all be torn down with a single stop() call.
//
// @example
// const stop = effectScope(() => {
//   store.bind(el, (s) => s.count, (count) => counterEl({ count }));
//   store.subscribe((s) => s.user, updateNav);
// });
//
// stop(); // tears down all bindings and subscriptions at once
// ---------------------------------------------------------------------------

export { effectScope } from "alien-signals";
