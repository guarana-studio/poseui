// =============================================================================
// poseui — core templating engine
// Zero dependencies. Fully synchronous.
// https://standardschema.dev
// =============================================================================

import { match } from "@poseui/match";

// ---------------------------------------------------------------------------
// Standard Schema v1 spec — copied inline, no runtime dep.
// ---------------------------------------------------------------------------

export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaV1.Props<Input, Output>;
}

export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
      options?: Options | undefined,
    ) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output> | undefined;
  }
  export type Result<Output> = SuccessResult<Output> | FailureResult;
  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }
  export interface Options {
    readonly libraryOptions?: Record<string, unknown> | undefined;
  }
  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }
  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }
  export interface PathSegment {
    readonly key: PropertyKey;
  }
  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }
  export type InferInput<S extends StandardSchemaV1> = NonNullable<
    S["~standard"]["types"]
  >["input"];
  export type InferOutput<S extends StandardSchemaV1> = NonNullable<
    S["~standard"]["types"]
  >["output"];
}

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
// Core types
// ---------------------------------------------------------------------------

export type Dyn<TProps, T> = T | ((props: TProps) => T);

export type ChildValue =
  | string
  | number
  | undefined
  | null
  | PoseElement<any, any>
  | Array<string | number | PoseElement<any, any> | undefined | null>;

export type Child<TProps> = ChildValue | ((props: TProps) => ChildValue);

type RenderReturn<TSchema extends StandardSchemaV1 | undefined> = TSchema extends StandardSchemaV1
  ? ReturnType<TSchema["~standard"]["validate"]> extends Promise<any>
    ? Promise<string>
    : string
  : string;

type CallArgs<TProps extends Record<string, unknown>, TSchema> = TSchema extends StandardSchemaV1
  ? [TProps?]
  : [keyof TProps] extends [never]
    ? [TProps?]
    : [TProps];

export type ClassEntry<TProps> = string | ((props: TProps) => string);

/** null means the attribute is omitted from the rendered output */
export type AttrValue = string | null;
export type AttrRecord<TProps> = Record<string, Dyn<TProps, AttrValue>>;
export type AttrEntry<TProps> =
  | [kind: "single", name: string, value: string | ((props: TProps) => AttrValue)]
  | [kind: "record", fn: (props: TProps) => Record<string, AttrValue>];

// ---------------------------------------------------------------------------
// Preset
// ---------------------------------------------------------------------------

/**
 * A preset extends every `PoseElement` created by a `Pose` instance with
 * additional fluent methods. Presets use TypeScript declaration merging to
 * augment the `PoseElement` interface — import the preset file to get both
 * the runtime behaviour and the type extensions.
 *
 * @example
 * // tailwind4.ts
 * export const tailwind4: Preset<PoseElement<any, any>> = {
 *   name: "tailwind4",
 *   extend(el, { cls, dynCls }) {
 *     el.flex = () => cls("flex");
 *     el.p    = (n) => dynCls(n, (v) => `p-${v}`);
 *   },
 * };
 */
export interface Preset<TElement> {
  readonly name: string;
  extend(
    element: TElement,
    helpers: {
      /** Add a static class name. */
      cls(name: string): TElement;
      /** Add a class derived from a value, static or dynamic. */
      dynCls<T>(raw: Dyn<Record<string, unknown>, T>, map: (v: T) => string): TElement;
    },
  ): void;
}

// ---------------------------------------------------------------------------
// PoseElement interface — structural methods only.
// Tailwind utility methods are added via the tailwind4 preset (declaration merging).
// ---------------------------------------------------------------------------

export interface PoseElement<
  TProps extends Record<string, unknown>,
  TSchema extends StandardSchemaV1 | undefined = undefined,
> {
  (...args: CallArgs<TProps, TSchema>): RenderReturn<TSchema>;

  readonly classes: ReadonlyArray<ClassEntry<TProps>>;

  /**
   * Returns the resolved class string for the given props without rendering
   * a full HTML string. Useful for testing and introspection.
   *
   * @example
   * button.getClasses({ variant: "primary" })
   * // → "px-4 py-2 rounded bg-indigo-600 text-white"
   */
  getClasses(props?: CallArgs<TProps, TSchema>[0]): string;

  /**
   * Bind a Standard Schema (Zod, Valibot, ArkType, …).
   * Infers TProps from the schema output type; validates on every render.
   */
  input<S extends StandardSchemaV1<any, Record<string, unknown>>>(
    schema: S,
  ): PoseElement<StandardSchemaV1.InferOutput<S>, S>;

  /**
   * Apply styles conditionally — predicate form or value-switch form.
   * Powered by @poseui/match internally.
   *
   * Predicate form (apply when true):
   * ```ts
   * .when(({ disabled }) => disabled, (b) => b.opacity(50).cursor_not_allowed())
   * ```
   *
   * Value form (switch on a prop key):
   * ```ts
   * .when("variant", {
   *   primary:   (b) => b.bg("indigo-600").text_color("white"),
   *   secondary: (b) => b.bg("slate-200").text_color("slate-900"),
   * })
   * ```
   */
  when(
    pred: (props: TProps) => boolean,
    apply: (b: PoseElement<TProps, undefined>) => PoseElement<TProps, any>,
  ): PoseElement<TProps, TSchema>;
  when<K extends keyof TProps>(
    key: K,
    cases: Partial<
      Record<
        TProps[K] & PropertyKey,
        (b: PoseElement<TProps, undefined>) => PoseElement<TProps, any>
      >
    >,
  ): PoseElement<TProps, TSchema>;

  /**
   * Set a single HTML attribute. `null` omits it; `""` renders as a boolean
   * attribute (`required`, `disabled`, etc.).
   *
   * @example
   * pose.as("a").attr("href", ({ url }) => url).attr("target", "_blank")
   */
  attr(name: string, value: Dyn<TProps, AttrValue>): PoseElement<TProps, TSchema>;

  /**
   * Set multiple HTML attributes at once, as a static/dynamic record or a
   * props function returning a record.
   *
   * @example
   * pose.as("a").attrs(({ url, external }) => ({
   *   href: url,
   *   target: external ? "_blank" : null,
   * }))
   */
  attrs(
    record: AttrRecord<TProps> | ((props: TProps) => Record<string, AttrValue>),
  ): PoseElement<TProps, TSchema>;

  /**
   * Append a raw class string or dynamic class function — escape hatch for
   * anything not covered by a preset.
   *
   * @example
   * .cls("hover:opacity-75")
   * .cls(({ active }) => active ? "ring-2 ring-blue-500" : "")
   */
  cls(value: Dyn<TProps, string>): PoseElement<TProps, TSchema>;

  child(fn: (props: TProps) => ChildValue): PoseElement<TProps, TSchema>;
  child(value: ChildValue): PoseElement<TProps, TSchema>;
}

// ---------------------------------------------------------------------------
// Pose interface
// ---------------------------------------------------------------------------

export interface Pose {
  as<Tag extends keyof HTMLElementTagNameMap>(
    tag: Tag,
  ): PoseElement<Record<never, never>, undefined>;

  /**
   * Returns a deduplicated, space-separated string of every static class name
   * registered across all elements created from this pose instance.
   * Dynamic class entries (functions) are skipped.
   *
   * Feed the result to Tailwind CLI or UnoCSS as a virtual source file.
   */
  getAllClasses(): string;
}

// ---------------------------------------------------------------------------
// Builder internals
// ---------------------------------------------------------------------------

export interface BuilderState<TProps extends Record<string, unknown>> {
  tag: string;
  classes: ClassEntry<TProps>[];
  attrs: AttrEntry<TProps>[];
  children: Child<TProps>[];
  schema: StandardSchemaV1 | undefined;
  registry: Set<ClassEntry<unknown>> | undefined;
  presets: Preset<PoseElement<any, any>>[];
}

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

function createBlankBuilder<TProps extends Record<string, unknown>>(
  presets: Preset<PoseElement<any, any>>[],
): PoseElement<TProps, undefined> {
  return createBuilder<TProps, undefined>({
    tag: "div",
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
>(state: BuilderState<TProps>): PoseElement<TProps, TSchema> {
  // Register all class entries with the pose instance registry
  if (state.registry) {
    for (const c of state.classes) state.registry.add(c as ClassEntry<unknown>);
  }

  // ---------------------------------------------------------------------------
  // Helpers exposed to presets
  // ---------------------------------------------------------------------------

  function derive(
    extraClasses: ClassEntry<TProps>[] = [],
    extraChildren: Child<TProps>[] = [],
    extraAttrs: AttrEntry<TProps>[] = [],
  ): PoseElement<TProps, TSchema> {
    if (state.registry) {
      for (const c of extraClasses) state.registry.add(c as ClassEntry<unknown>);
    }
    return createBuilder<TProps, TSchema>({
      ...state,
      classes: [...state.classes, ...extraClasses],
      attrs: [...state.attrs, ...extraAttrs],
      children: [...state.children, ...extraChildren],
    });
  }

  function cls(name: string): PoseElement<TProps, TSchema> {
    return derive([name]);
  }

  function dynCls<T>(raw: Dyn<TProps, T>, map: (v: T) => string): PoseElement<TProps, TSchema> {
    if (typeof raw === "function") {
      const fn = raw as (p: TProps) => T;
      return derive([(props: TProps) => map(fn(props))]);
    }
    return derive([map(raw as T)]);
  }

  // ---------------------------------------------------------------------------
  // HTML rendering
  // ---------------------------------------------------------------------------

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

  const el = render as PoseElement<TProps, TSchema>;

  Object.defineProperty(el, "classes", { get: () => state.classes, enumerable: true });

  // ---------------------------------------------------------------------------
  // Core methods
  // ---------------------------------------------------------------------------

  el.getClasses = (props?: any): string => resolveClasses(state.classes, (props ?? {}) as TProps);

  el.input = <S extends StandardSchemaV1<any, Record<string, unknown>>>(schema: S) =>
    createBuilder<StandardSchemaV1.InferOutput<S>, S>({
      tag: state.tag,
      classes: state.classes as unknown as ClassEntry<StandardSchemaV1.InferOutput<S>>[],
      attrs: state.attrs as unknown as AttrEntry<StandardSchemaV1.InferOutput<S>>[],
      children: state.children as unknown as Child<StandardSchemaV1.InferOutput<S>>[],
      schema,
      registry: state.registry,
      presets: state.presets,
    });

  // ---------------------------------------------------------------------------
  // .when() — powered by @poseui/match
  // ---------------------------------------------------------------------------

  function applyBranch(
    getBranch: (props: TProps) => PoseElement<TProps, undefined> | null,
  ): PoseElement<TProps, TSchema> {
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
        (b: PoseElement<TProps, undefined>) => PoseElement<TProps, any>,
      ];

      // Pre-evaluate branch to register static classes for getAllClasses()
      const previewBranch = apply(createBlankBuilder<TProps>(state.presets));
      for (const c of previewBranch.classes) {
        if (typeof c === "string" && state.registry) state.registry.add(c);
      }

      return applyBranch(
        (props) =>
          // Use match internally to evaluate the predicate
          match<Record<string, unknown>>(props as Record<string, unknown>)
            .when(pred as (v: Record<string, unknown>) => boolean, () =>
              apply(createBlankBuilder<TProps>(state.presets)),
            )
            .first() ?? null,
      );
    }

    const [key, cases] = args as [
      keyof TProps,
      Record<PropertyKey, (b: PoseElement<TProps, undefined>) => PoseElement<TProps, any>>,
    ];

    // Pre-evaluate all branches to register static classes for getAllClasses()
    for (const branchFn of Object.values(cases)) {
      const previewBranch = branchFn(createBlankBuilder<TProps>(state.presets));
      for (const c of previewBranch.classes) {
        if (typeof c === "string" && state.registry) state.registry.add(c);
      }
    }

    return applyBranch(
      (props) =>
        // Use match internally to switch on the key
        match<TProps>(props)
          .when(
            key as keyof TProps,
            Object.fromEntries(
              Object.entries(cases).map(([k, branchFn]) => [
                k,
                () => branchFn(createBlankBuilder<TProps>(state.presets)),
              ]),
            ) as any,
          )
          .first() ?? null,
    );
  };

  // ---------------------------------------------------------------------------
  // Attributes
  // ---------------------------------------------------------------------------

  el.attr = (name, value) =>
    derive([], [], [["single", name, value as string | ((p: TProps) => AttrValue)]]);

  el.attrs = (recordOrFn) => {
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

  // ---------------------------------------------------------------------------
  // Escape hatch
  // ---------------------------------------------------------------------------

  el.cls = (value) => derive([value as ClassEntry<TProps>]);

  // ---------------------------------------------------------------------------
  // Children
  // ---------------------------------------------------------------------------

  el.child = (value: any) =>
    createBuilder<TProps, TSchema>({
      ...state,
      classes: [...state.classes],
      attrs: [...state.attrs],
      children: [...state.children, value],
      registry: state.registry,
      presets: state.presets,
    });

  // ---------------------------------------------------------------------------
  // Apply presets — each preset receives the element and the typed helpers
  // ---------------------------------------------------------------------------

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

export interface CreatePoseOptions {
  presets?: Preset<PoseElement<any, any>>[];
}

/**
 * Create a dedicated Pose instance, optionally with presets that extend every
 * element with additional fluent methods.
 *
 * Import a preset file to get both runtime behaviour and type augmentation
 * via declaration merging.
 *
 * @example
 * import { createPose } from "poseui";
 * import { tailwind4 } from "poseui/tailwind4";
 *
 * const pose = createPose({ presets: [tailwind4] });
 * const button = pose.as("button").flex().px(4).bg("indigo-600");
 */
export function createPose(options: CreatePoseOptions = {}): Pose {
  const { presets = [] } = options;
  const registry = new Set<ClassEntry<unknown>>();

  return {
    as(tag) {
      return createBuilder({
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
