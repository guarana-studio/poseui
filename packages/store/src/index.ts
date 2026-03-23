// =============================================================================
// @poseui/store — zustand-shaped reactive store backed by alien-signals
// =============================================================================

import { signal, computed, effect } from "alien-signals";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SetState<T> {
  (update: Partial<T>): void;
  (updater: (state: T) => Partial<T>): void;
}

export type GetState<T> = () => T;
export type Listener<T> = (state: T, prevState: T) => void;
export type SliceListener<_T, S> = (slice: S, prevSlice: S) => void;
export type Unsub = () => void;

export interface StoreApi<T extends object> {
  setState(update: Partial<T> | ((state: T) => Partial<T>)): void;
  getState(): T;
  getInitialState(): T;
  subscribe(listener: Listener<T>): Unsub;
  subscribe<S>(selector: (state: T) => S, listener: SliceListener<T, S>): Unsub;
  bind(el: Element, render: (state: T) => string): Unsub;
  bind<S>(el: Element, selector: (state: T) => S, render: (slice: S) => string): Unsub;
}

// ---------------------------------------------------------------------------
// ActionsCreator
//
// `set` and `get` are typed against TState only — actions patch state, they
// don't set other actions. This breaks the TActions self-reference that was
// causing the inference deadlock, and lets TypeScript infer TActions purely
// from the return type of the creator.
//
// `get` returns TState here but at runtime it returns TState & TActions, so
// actions can freely call each other via get().someAction().
//
// `getInitialState` replaces the old `api` argument — it's the only thing
// `get()` cannot provide, since get() returns live state not the snapshot
// frozen at construction time.
// ---------------------------------------------------------------------------

type ActionsCreator<TState extends object, TActions extends object> = (
  set: SetState<TState>,
  get: GetState<TState & TActions>,
  getInitialState: () => TState,
) => TActions;

// ---------------------------------------------------------------------------
// createStore
// ---------------------------------------------------------------------------

export function createStore<TState extends object>(initialState: TState): StoreApi<TState>;

export function createStore<TState extends object, TActions extends object>(
  initialState: TState,
  actions: ActionsCreator<TState, TActions>,
): StoreApi<TState & TActions>;

export function createStore<TState extends object, TActions extends object = Record<never, never>>(
  initialState: TState,
  actionsCreator?: ActionsCreator<TState, TActions>,
): StoreApi<TState & TActions> {
  type T = TState & TActions;

  const stateSignal = signal<T>({} as T);

  function setState(update: Partial<T> | ((state: T) => Partial<T>)): void {
    const current = stateSignal();
    const patch = typeof update === "function" ? update(current) : update;
    stateSignal({ ...current, ...patch });
  }

  function getState(): T {
    return stateSignal();
  }

  function subscribe(listener: Listener<T>): Unsub;
  function subscribe<S>(selector: (state: T) => S, listener: SliceListener<T, S>): Unsub;
  function subscribe<S>(
    listenerOrSelector: Listener<T> | ((state: T) => S),
    maybeListener?: SliceListener<T, S>,
  ): Unsub {
    if (maybeListener === undefined) {
      const listener = listenerOrSelector as Listener<T>;
      let prev = stateSignal();
      let first = true;
      return effect(() => {
        const current = stateSignal();
        if (first) {
          first = false;
          return;
        }
        listener(current, prev);
        prev = current;
      });
    }

    const selector = listenerOrSelector as (state: T) => S;
    const sliceComputed = computed(() => selector(stateSignal()));
    let prevSlice = sliceComputed();
    let first = true;
    return effect(() => {
      const currentSlice = sliceComputed();
      if (first) {
        first = false;
        return;
      }
      if (!Object.is(currentSlice, prevSlice)) {
        maybeListener(currentSlice, prevSlice);
        prevSlice = currentSlice;
      }
    });
  }

  function bind(el: Element, render: (state: T) => string): Unsub;
  function bind<S>(el: Element, selector: (state: T) => S, render: (slice: S) => string): Unsub;
  function bind<S>(
    el: Element,
    renderOrSelector: ((state: T) => string) | ((state: T) => S),
    maybeRender?: (slice: S) => string,
  ): Unsub {
    if (maybeRender === undefined) {
      return effect(() => {
        el.innerHTML = (renderOrSelector as (state: T) => string)(stateSignal());
      });
    }
    const sliceComputed = computed(() => (renderOrSelector as (state: T) => S)(stateSignal()));
    return effect(() => {
      el.innerHTML = maybeRender(sliceComputed());
    });
  }

  let resolvedInitialState: T;

  const api: StoreApi<T> = {
    setState,
    getState,
    getInitialState: () => resolvedInitialState,
    subscribe,
    bind,
  };

  const resolvedActions = actionsCreator
    ? actionsCreator(
        setState as unknown as SetState<TState>,
        getState,
        () => resolvedInitialState as unknown as TState,
      )
    : ({} as TActions);

  resolvedInitialState = { ...initialState, ...resolvedActions };
  stateSignal(resolvedInitialState);

  return api;
}

export { effectScope } from "alien-signals";
