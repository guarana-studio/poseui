// =============================================================================
// poseui — builder runtime
// Zero dependencies. Fully synchronous.
// =============================================================================

import { match } from "@poseui/match";

import type {
  StandardSchemaV1,
  Dyn,
  ChildValue,
  Child,
  CallArgs,
  ClassEntry,
  AttrValue,
  AttrEntry,
  Preset,
  PoseElement,
  Pose,
  BuilderState,
  CreatePoseOptions,
  EventMap,
  HandlerContext,
  Component,
} from "./types";

// Re-export everything consumers need from a single entry point.
export type {
  StandardSchemaV1,
  Dyn,
  ChildValue,
  Child,
  CallArgs,
  ClassEntry,
  AttrValue,
  AttrEntry,
  Preset,
  PoseElement,
  Pose,
  BuilderState,
  CreatePoseOptions,
  EventMap,
  HandlerContext,
  Component,
} from "./types";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export class PoseValidationError extends Error {
  readonly issues: ReadonlyArray<StandardSchemaV1.Issue>;
  constructor(issues: ReadonlyArray<StandardSchemaV1.Issue>) {
    const summary = issues
      .map((i) => {
        const path = i.path?.map((p) => (typeof p === "object" ? p.key : p)).join(".");
        return path ? `${path}: ${i.message}` : i.message;
      })
      .join("; ");
    super(`Pose validation failed — ${summary}`);
    this.name = "PoseValidationError";
    this.issues = issues;
  }
}

function runSchema<S extends StandardSchemaV1>(
  schema: S,
  value: unknown,
): StandardSchemaV1.InferOutput<S> | Promise<StandardSchemaV1.InferOutput<S>> {
  const result = schema["~standard"].validate(value);
  if (result instanceof Promise) {
    return result.then(unwrapResult) as Promise<StandardSchemaV1.InferOutput<S>>;
  }
  return unwrapResult(result) as StandardSchemaV1.InferOutput<S>;
}

function unwrapResult<O>(result: StandardSchemaV1.Result<O>): O {
  if (result.issues !== undefined) throw new PoseValidationError(result.issues);
  return (result as StandardSchemaV1.SuccessResult<O>).value;
}

// ---------------------------------------------------------------------------
// Internal render helpers
// ---------------------------------------------------------------------------

function resolveClasses<TProps>(classes: ReadonlyArray<ClassEntry<TProps>>, props: TProps): string {
  return classes
    .map((c) => (typeof c === "function" ? c(props) : c))
    .filter(Boolean)
    .join(" ");
}

function renderAttrPair(name: string, value: AttrValue): string {
  if (value === null) return "";
  return value === "" ? name : `${name}="${value}"`;
}

function resolveAttrs<TProps>(attrs: AttrEntry<TProps>[], props: TProps): string {
  const parts: string[] = [];
  for (const entry of attrs) {
    if (entry[0] === "single") {
      const [, name, value] = entry;
      const resolved = typeof value === "function" ? value(props) : value;
      const rendered = renderAttrPair(name, resolved);
      if (rendered) parts.push(rendered);
    } else {
      const [, fn] = entry;
      for (const [name, value] of Object.entries(fn(props))) {
        const rendered = renderAttrPair(name, value);
        if (rendered) parts.push(rendered);
      }
    }
  }
  return parts.join(" ");
}

function renderChild(child: unknown, props: Record<string, unknown>): string {
  if (typeof child === "function") return renderChild((child as Function)(props), props);
  if (Array.isArray(child))
    return child
      .filter((c) => c != null)
      .map((c) => renderChild(c, props))
      .join("");
  if (child != null && typeof child === "object" && "__pose" in child) {
    return (child as (p: Record<string, unknown>) => string)(props);
  }
  return child == null ? "" : String(child);
}

// ---------------------------------------------------------------------------
// Builder internals
// ---------------------------------------------------------------------------

function createBlankBuilder<TProps extends Record<string, unknown>>(
  presets: Preset<PoseElement<any, any, any>>[],
  tag: string = "div",
): PoseElement<TProps, undefined, string> {
  return createBuilder<TProps, undefined, string>({
    tag,
    classes: [],
    attrs: [],
    children: [],
    schema: undefined,
    registry: undefined,
    presets,
  });
}

export function createBuilder<
  TProps extends Record<string, unknown>,
  TSchema extends StandardSchemaV1 | undefined = undefined,
  TTag extends string = string,
>(state: BuilderState<TProps>): PoseElement<TProps, TSchema, TTag> {
  if (state.registry) {
    for (const c of state.classes) state.registry.add(c as ClassEntry<unknown>);
  }

  function derive(
    extraClasses: ClassEntry<TProps>[] = [],
    extraChildren: Child<TProps>[] = [],
    extraAttrs: AttrEntry<TProps>[] = [],
  ): PoseElement<TProps, TSchema, TTag> {
    if (state.registry) {
      for (const c of extraClasses) state.registry.add(c as ClassEntry<unknown>);
    }
    return createBuilder<TProps, TSchema, TTag>({
      ...state,
      classes: [...state.classes, ...extraClasses],
      attrs: [...state.attrs, ...extraAttrs],
      children: [...state.children, ...extraChildren],
    });
  }

  function cls(name: string): PoseElement<TProps, TSchema, TTag> {
    return derive([name]);
  }

  function dynCls<T>(
    raw: Dyn<TProps, T>,
    map: (v: T) => string,
  ): PoseElement<TProps, TSchema, TTag> {
    if (typeof raw === "function") {
      const fn = raw as (p: TProps) => T;
      return derive([(props: TProps) => map(fn(props))]);
    }
    return derive([map(raw as T)]);
  }

  function buildHtml(resolvedProps: TProps): string {
    const classStr = resolveClasses(state.classes, resolvedProps);
    const attrsStr = resolveAttrs(state.attrs, resolvedProps);
    const childrenStr = state.children
      .map((c) => renderChild(c, resolvedProps as Record<string, unknown>))
      .join("");
    const classAttr = classStr ? ` class="${classStr}"` : "";
    const attrsAttr = attrsStr ? ` ${attrsStr}` : "";
    return `<${state.tag}${classAttr}${attrsAttr}>${childrenStr}</${state.tag}>`;
  }

  function render(...args: CallArgs<TProps, TSchema>): any {
    const props = (args[0] ?? {}) as TProps;
    if (!state.schema) return buildHtml(props);
    const result = runSchema(state.schema, props);
    if (result instanceof Promise) return result.then((v) => buildHtml(v as TProps));
    return buildHtml(result as TProps);
  }

  (render as any).__pose = true;
  (render as any).__state = state;

  const el = render as PoseElement<TProps, TSchema, TTag>;

  Object.defineProperty(el, "classes", { get: () => state.classes, enumerable: true });

  el.getClasses = (props?: any): string => resolveClasses(state.classes, (props ?? {}) as TProps);

  el.input = <S extends StandardSchemaV1<any, Record<string, unknown>>>(schema: S) =>
    createBuilder<StandardSchemaV1.InferOutput<S>, S, TTag>({
      tag: state.tag,
      classes: state.classes as unknown as ClassEntry<StandardSchemaV1.InferOutput<S>>[],
      attrs: state.attrs as unknown as AttrEntry<StandardSchemaV1.InferOutput<S>>[],
      children: state.children as unknown as Child<StandardSchemaV1.InferOutput<S>>[],
      schema,
      registry: state.registry,
      presets: state.presets,
    });

  // .when() — powered by @poseui/match

  function applyBranch(
    getBranch: (props: TProps) => PoseElement<TProps, undefined, TTag> | null,
  ): PoseElement<TProps, TSchema, TTag> {
    const classEntry: ClassEntry<TProps> = (props) => {
      const branch = getBranch(props);
      return branch ? resolveClasses(branch.classes, props) : "";
    };

    const childEntry: Child<TProps> = (props: TProps) => {
      const branch = getBranch(props);
      if (!branch) return null;
      const branchState = (branch as any).__state as BuilderState<TProps>;
      if (!branchState.children.length) return null;
      return branchState.children.map((c) =>
        typeof c === "function" ? c(props) : c,
      ) as ChildValue;
    };

    return derive([classEntry], [childEntry]);
  }

  el.when = (...args: any[]): any => {
    if (typeof args[0] === "function") {
      const [pred, apply] = args as [
        (props: TProps) => boolean,
        (b: PoseElement<TProps, undefined, TTag>) => PoseElement<TProps, any, TTag>,
      ];

      const blank = createBlankBuilder<TProps>(state.presets, state.tag) as PoseElement<
        TProps,
        undefined,
        TTag
      >;
      const previewBranch = apply(blank);
      for (const c of previewBranch.classes) {
        if (typeof c === "string" && state.registry) state.registry.add(c);
      }

      return applyBranch(
        (props) =>
          match<Record<string, unknown>, PoseElement<TProps, undefined, TTag>>(
            props as Record<string, unknown>,
          )
            .when(pred as (v: Record<string, unknown>) => boolean, () =>
              apply(
                createBlankBuilder<TProps>(state.presets, state.tag) as PoseElement<
                  TProps,
                  undefined,
                  TTag
                >,
              ),
            )
            .first() ?? null,
      );
    }

    const [key, cases] = args as [
      keyof TProps,
      Record<
        PropertyKey,
        (b: PoseElement<TProps, undefined, TTag>) => PoseElement<TProps, any, TTag>
      >,
    ];

    for (const branchFn of Object.values(cases)) {
      const blank = createBlankBuilder<TProps>(state.presets, state.tag) as PoseElement<
        TProps,
        undefined,
        TTag
      >;
      const previewBranch = branchFn(blank);
      for (const c of previewBranch.classes) {
        if (typeof c === "string" && state.registry) state.registry.add(c);
      }
    }

    return applyBranch((props) => {
      const branchFn = cases[props[key] as PropertyKey];
      return branchFn
        ? branchFn(
            createBlankBuilder<TProps>(state.presets, state.tag) as PoseElement<
              TProps,
              undefined,
              TTag
            >,
          )
        : null;
    });
  };

  // .attr() — name constrained to AttrName<TTag>, value to AttrValueFor<TTag, K>

  el.attr = (name: any, value: any) =>
    derive([], [], [["single", name, value as string | ((p: TProps) => AttrValue)]]);

  // .attrs() — record keys constrained to AttrName<TTag>

  el.attrs = (recordOrFn: any) => {
    if (typeof recordOrFn === "function") {
      return derive([], [], [["record", recordOrFn as (p: TProps) => Record<string, AttrValue>]]);
    }
    const entries: AttrEntry<TProps>[] = Object.entries(recordOrFn).map(([name, value]) => [
      "single",
      name,
      value as string | ((p: TProps) => AttrValue),
    ]);
    return derive([], [], entries);
  };

  // .cls()

  el.cls = (value) => derive([value as ClassEntry<TProps>]);

  // .child()

  el.child = (value: any) =>
    createBuilder<TProps, TSchema, TTag>({
      ...state,
      classes: [...state.classes],
      attrs: [...state.attrs],
      children: [...state.children, value],
      registry: state.registry,
      presets: state.presets,
    });

  // .handler() — closes the builder into a mountable Component
  //
  // The returned Component is callable (same signature as the PoseElement) so
  // it can be used as a .child() or html`` slot without needing an independent
  // mount — the outermost parent's single .mount() call activates all listeners
  // for the whole tree via the shared EventMap.

  el.handler = <TEvents extends EventMap>(
    fn: (ctx: HandlerContext<TProps, TEvents>) => void,
  ): Component<TProps, TSchema, TEvents> => {
    // Shared schema resolution — used by the call signature, mount(), and render().
    function resolve(raw: unknown): TProps {
      if (!state.schema) return (raw ?? {}) as TProps;
      const result = runSchema(state.schema, raw ?? {});
      if (result instanceof Promise) {
        throw new Error(
          "PoseElement.handler: async schemas are not supported in .mount(). " +
            "Resolve the schema before mounting.",
        );
      }
      return result as TProps;
    }

    // The call signature renders to an HTML string — identical to the
    // underlying PoseElement, allowing Component to compose as a child.
    function component(...args: CallArgs<TProps, TSchema>): any {
      const props = (args[0] ?? {}) as TProps;
      if (!state.schema) return buildHtml(props);
      const result = runSchema(state.schema, props);
      if (result instanceof Promise) return result.then((v) => buildHtml(v as TProps));
      return buildHtml(result as TProps);
    }

    component.mount = function (
      rootEl: Element,
      events: TEvents,
      ...args: CallArgs<TProps, TSchema>
    ): () => void {
      // Initial render.
      const initialProps = resolve(args[0]);
      rootEl.innerHTML = buildHtml(initialProps);

      // render() re-runs schema resolution and swaps innerHTML.
      // Events stay mounted — @poseui/on binds to selectors, not nodes.
      function render(props?: Partial<TProps>): void {
        rootEl.innerHTML = buildHtml(resolve(props));
      }

      // Run the handler so the caller can wire listeners and subscriptions.
      fn({ input: initialProps, el: rootEl, events, render });

      // Mount events scoped to this element and return the cleanup.
      return events.mount(rootEl);
    };

    // Mark as a PoseElement-compatible callable so renderChild and
    // template spread detection both recognise it correctly.
    (component as any).__pose = true;
    (component as any).__state = state;

    return component as unknown as Component<TProps, TSchema, TEvents>;
  };

  // Apply presets

  const presetHelpers = {
    cls: (name: string) => cls(name),
    dynCls: <T>(raw: Dyn<Record<string, unknown>, T>, map: (v: T) => string) =>
      dynCls(raw as Dyn<TProps, T>, map),
  };

  for (const preset of state.presets) {
    preset.extend(el, presetHelpers);
  }

  return el;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createPose(options: CreatePoseOptions = {}): Pose {
  const { presets = [] } = options;
  const registry = new Set<ClassEntry<unknown>>();

  return {
    as<Tag extends keyof HTMLElementTagNameMap>(tag: Tag) {
      return createBuilder<Record<never, never>, undefined, Tag>({
        tag,
        classes: [],
        attrs: [],
        children: [],
        schema: undefined,
        registry,
        presets,
      });
    },
    getAllClasses(): string {
      const seen = new Set<string>();
      for (const entry of registry) {
        if (typeof entry === "string" && entry) seen.add(entry);
      }
      return [...seen].join(" ");
    },
  };
}

/** Default pose instance — no presets. Use createPose({ presets }) for utility methods. */
const pose: Pose = createPose();

export const div = pose.as("div");

export default pose;
