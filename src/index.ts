// =============================================================================
// TypeScript templating & styling engine backed by UnoCSS + presetWind4
// https://standardschema.dev  |  https://unocss.dev/presets/wind4
// =============================================================================

import type { GenerateOptions, UnoGenerator } from "@unocss/core";

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
  ? [TProps?] // When schema exists, props are optional
  : [keyof TProps] extends [never]
    ? [TProps?] // When no props, make it optional
    : [TProps]; // When props required, make it required

type ClassEntry<TProps> = string | ((props: TProps) => string);

// ---------------------------------------------------------------------------
// PoseElement interface
// ---------------------------------------------------------------------------

export interface PoseElement<
  TProps extends Record<string, unknown>,
  TSchema extends StandardSchemaV1 | undefined = undefined,
> {
  (...args: CallArgs<TProps, TSchema>): RenderReturn<TSchema>;

  readonly classes: ReadonlyArray<ClassEntry<TProps>>;

  /**
   * Bind a Standard Schema (Zod, Valibot, ArkType, …).
   * Infers TProps from output type; validates on every render.
   */
  input<S extends StandardSchemaV1<any, Record<string, unknown>>>(
    schema: S,
  ): PoseElement<StandardSchemaV1.InferOutput<S>, S>;

  // ── Display ──────────────────────────────────────────────────────────────
  /** block */
  block(): PoseElement<TProps, TSchema>;
  /** inline */
  inline(): PoseElement<TProps, TSchema>;
  /** inline-block */
  inline_block(): PoseElement<TProps, TSchema>;
  /** flex */
  flex(): PoseElement<TProps, TSchema>;
  /** inline-flex */
  inline_flex(): PoseElement<TProps, TSchema>;
  /** grid */
  grid(): PoseElement<TProps, TSchema>;
  /** inline-grid */
  inline_grid(): PoseElement<TProps, TSchema>;
  /** flow-root */
  flow_root(): PoseElement<TProps, TSchema>;
  /** hidden (display:none) */
  hidden(): PoseElement<TProps, TSchema>;
  /** contents */
  contents(): PoseElement<TProps, TSchema>;
  /** table */
  table(): PoseElement<TProps, TSchema>;
  /** table-caption */
  table_caption(): PoseElement<TProps, TSchema>;
  /** table-cell */
  table_cell(): PoseElement<TProps, TSchema>;
  /** table-column */
  table_column(): PoseElement<TProps, TSchema>;
  /** table-column-group */
  table_column_group(): PoseElement<TProps, TSchema>;
  /** table-footer-group */
  table_footer_group(): PoseElement<TProps, TSchema>;
  /** table-header-group */
  table_header_group(): PoseElement<TProps, TSchema>;
  /** table-row-group */
  table_row_group(): PoseElement<TProps, TSchema>;
  /** table-row */
  table_row(): PoseElement<TProps, TSchema>;

  // ── Flexbox ──────────────────────────────────────────────────────────────
  /** flex-row */
  flex_row(): PoseElement<TProps, TSchema>;
  /** flex-row-reverse */
  flex_row_reverse(): PoseElement<TProps, TSchema>;
  /** flex-col */
  flex_col(): PoseElement<TProps, TSchema>;
  /** flex-col-reverse */
  flex_col_reverse(): PoseElement<TProps, TSchema>;
  /** flex-wrap */
  flex_wrap(): PoseElement<TProps, TSchema>;
  /** flex-wrap-reverse */
  flex_wrap_reverse(): PoseElement<TProps, TSchema>;
  /** flex-nowrap */
  flex_nowrap(): PoseElement<TProps, TSchema>;
  /** flex-1 */
  flex_1(): PoseElement<TProps, TSchema>;
  /** flex-auto */
  flex_auto(): PoseElement<TProps, TSchema>;
  /** flex-initial */
  flex_initial(): PoseElement<TProps, TSchema>;
  /** flex-none */
  flex_none(): PoseElement<TProps, TSchema>;
  /** grow / flex-grow */
  grow(): PoseElement<TProps, TSchema>;
  /** grow-0 / flex-grow-0 */
  grow_0(): PoseElement<TProps, TSchema>;
  /** shrink / flex-shrink */
  shrink(): PoseElement<TProps, TSchema>;
  /** shrink-0 / flex-shrink-0 */
  shrink_0(): PoseElement<TProps, TSchema>;
  /** order-{n} */
  order(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** order-first */
  order_first(): PoseElement<TProps, TSchema>;
  /** order-last */
  order_last(): PoseElement<TProps, TSchema>;
  /** order-none */
  order_none(): PoseElement<TProps, TSchema>;

  // ── Grid ─────────────────────────────────────────────────────────────────
  /** grid-cols-{n} */
  grid_cols(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** grid-rows-{n} */
  grid_rows(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** col-span-{n} */
  col_span(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** col-start-{n} */
  col_start(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** col-end-{n} */
  col_end(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** row-span-{n} */
  row_span(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** row-start-{n} */
  row_start(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** row-end-{n} */
  row_end(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** grid-flow-row */
  grid_flow_row(): PoseElement<TProps, TSchema>;
  /** grid-flow-col */
  grid_flow_col(): PoseElement<TProps, TSchema>;
  /** grid-flow-dense */
  grid_flow_dense(): PoseElement<TProps, TSchema>;
  /** auto-cols-{value} */
  auto_cols(value: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** auto-rows-{value} */
  auto_rows(value: Dyn<TProps, string>): PoseElement<TProps, TSchema>;

  // ── Alignment ────────────────────────────────────────────────────────────
  /** justify-start */
  justify_start(): PoseElement<TProps, TSchema>;
  /** justify-end */
  justify_end(): PoseElement<TProps, TSchema>;
  /** justify-center */
  justify_center(): PoseElement<TProps, TSchema>;
  /** justify-between */
  justify_between(): PoseElement<TProps, TSchema>;
  /** justify-around */
  justify_around(): PoseElement<TProps, TSchema>;
  /** justify-evenly */
  justify_evenly(): PoseElement<TProps, TSchema>;
  /** justify-items-start */
  justify_items_start(): PoseElement<TProps, TSchema>;
  /** justify-items-end */
  justify_items_end(): PoseElement<TProps, TSchema>;
  /** justify-items-center */
  justify_items_center(): PoseElement<TProps, TSchema>;
  /** justify-items-stretch */
  justify_items_stretch(): PoseElement<TProps, TSchema>;
  /** justify-self-auto */
  justify_self_auto(): PoseElement<TProps, TSchema>;
  /** justify-self-start */
  justify_self_start(): PoseElement<TProps, TSchema>;
  /** justify-self-end */
  justify_self_end(): PoseElement<TProps, TSchema>;
  /** justify-self-center */
  justify_self_center(): PoseElement<TProps, TSchema>;
  /** justify-self-stretch */
  justify_self_stretch(): PoseElement<TProps, TSchema>;
  /** items-start */
  items_start(): PoseElement<TProps, TSchema>;
  /** items-end */
  items_end(): PoseElement<TProps, TSchema>;
  /** items-center */
  items_center(): PoseElement<TProps, TSchema>;
  /** items-stretch */
  items_stretch(): PoseElement<TProps, TSchema>;
  /** items-baseline */
  items_baseline(): PoseElement<TProps, TSchema>;
  /** self-auto */
  self_auto(): PoseElement<TProps, TSchema>;
  /** self-start */
  self_start(): PoseElement<TProps, TSchema>;
  /** self-end */
  self_end(): PoseElement<TProps, TSchema>;
  /** self-center */
  self_center(): PoseElement<TProps, TSchema>;
  /** self-stretch */
  self_stretch(): PoseElement<TProps, TSchema>;
  /** self-baseline */
  self_baseline(): PoseElement<TProps, TSchema>;
  /** content-start */
  content_start(): PoseElement<TProps, TSchema>;
  /** content-end */
  content_end(): PoseElement<TProps, TSchema>;
  /** content-center */
  content_center(): PoseElement<TProps, TSchema>;
  /** content-between */
  content_between(): PoseElement<TProps, TSchema>;
  /** content-around */
  content_around(): PoseElement<TProps, TSchema>;
  /** content-evenly */
  content_evenly(): PoseElement<TProps, TSchema>;
  /** place-content-{value} */
  place_content(value: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** place-items-{value} */
  place_items(value: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** place-self-{value} */
  place_self(value: Dyn<TProps, string>): PoseElement<TProps, TSchema>;

  // ── Spacing ──────────────────────────────────────────────────────────────
  /** gap-{n} */
  gap(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  gap_0(): PoseElement<TProps, TSchema>;
  gap_1(): PoseElement<TProps, TSchema>;
  gap_2(): PoseElement<TProps, TSchema>;
  gap_3(): PoseElement<TProps, TSchema>;
  gap_4(): PoseElement<TProps, TSchema>;
  gap_5(): PoseElement<TProps, TSchema>;
  gap_6(): PoseElement<TProps, TSchema>;
  gap_7(): PoseElement<TProps, TSchema>;
  gap_8(): PoseElement<TProps, TSchema>;
  /** gap-x-{n} */
  gap_x(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** gap-y-{n} */
  gap_y(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** space-x-{n} — margin between horizontal children */
  space_x(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** space-y-{n} — margin between vertical children */
  space_y(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** space-x-reverse */
  space_x_reverse(): PoseElement<TProps, TSchema>;
  /** space-y-reverse */
  space_y_reverse(): PoseElement<TProps, TSchema>;
  /** p-{n} */
  p(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** px-{n} */
  px(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** py-{n} */
  py(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** pt-{n} */
  pt(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** pr-{n} */
  pr(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** pb-{n} */
  pb(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** pl-{n} */
  pl(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** m-{n} */
  m(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** mx-{n} */
  mx(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** my-{n} */
  my(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** mt-{n} */
  mt(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** mr-{n} */
  mr(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** mb-{n} */
  mb(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** ml-{n} */
  ml(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** m-auto */
  m_auto(): PoseElement<TProps, TSchema>;
  /** mx-auto */
  mx_auto(): PoseElement<TProps, TSchema>;
  /** my-auto */
  my_auto(): PoseElement<TProps, TSchema>;

  // ── Sizing ───────────────────────────────────────────────────────────────
  /** size-{n} */
  size(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** w-{n} */
  w(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** w-full */
  w_full(): PoseElement<TProps, TSchema>;
  /** w-screen */
  w_screen(): PoseElement<TProps, TSchema>;
  /** w-min */
  w_min(): PoseElement<TProps, TSchema>;
  /** w-max */
  w_max(): PoseElement<TProps, TSchema>;
  /** w-fit */
  w_fit(): PoseElement<TProps, TSchema>;
  /** h-{n} */
  h(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** h-full */
  h_full(): PoseElement<TProps, TSchema>;
  /** h-screen */
  h_screen(): PoseElement<TProps, TSchema>;
  /** h-min */
  h_min(): PoseElement<TProps, TSchema>;
  /** h-max */
  h_max(): PoseElement<TProps, TSchema>;
  /** h-fit */
  h_fit(): PoseElement<TProps, TSchema>;
  /** min-w-{n} */
  min_w(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** max-w-{n} */
  max_w(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** min-h-{n} */
  min_h(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** max-h-{n} */
  max_h(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** aspect-{value} e.g. "auto", "square", "video" */
  aspect(value: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** aspect-auto */
  aspect_auto(): PoseElement<TProps, TSchema>;
  /** aspect-square */
  aspect_square(): PoseElement<TProps, TSchema>;
  /** aspect-video */
  aspect_video(): PoseElement<TProps, TSchema>;

  // ── Position ─────────────────────────────────────────────────────────────
  /** static */
  static_pos(): PoseElement<TProps, TSchema>;
  /** relative */
  relative(): PoseElement<TProps, TSchema>;
  /** absolute */
  absolute(): PoseElement<TProps, TSchema>;
  /** fixed */
  fixed(): PoseElement<TProps, TSchema>;
  /** sticky */
  sticky(): PoseElement<TProps, TSchema>;
  /** inset-{n} */
  inset(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** inset-0 */
  inset_0(): PoseElement<TProps, TSchema>;
  /** inset-x-{n} */
  inset_x(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** inset-y-{n} */
  inset_y(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** top-{n} */
  top(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** right-{n} */
  right(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** bottom-{n} */
  bottom(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** left-{n} */
  left(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** z-{n} */
  z(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;

  // ── Visibility ───────────────────────────────────────────────────────────
  /** visible */
  visible(): PoseElement<TProps, TSchema>;
  /** invisible */
  invisible(): PoseElement<TProps, TSchema>;

  // ── Float & Clear ────────────────────────────────────────────────────────
  /** float-left */
  float_left(): PoseElement<TProps, TSchema>;
  /** float-right */
  float_right(): PoseElement<TProps, TSchema>;
  /** float-none */
  float_none(): PoseElement<TProps, TSchema>;
  /** clear-left */
  clear_left(): PoseElement<TProps, TSchema>;
  /** clear-right */
  clear_right(): PoseElement<TProps, TSchema>;
  /** clear-both */
  clear_both(): PoseElement<TProps, TSchema>;
  /** clear-none */
  clear_none(): PoseElement<TProps, TSchema>;

  // ── Box Sizing ───────────────────────────────────────────────────────────
  /** box-border */
  box_border(): PoseElement<TProps, TSchema>;
  /** box-content */
  box_content(): PoseElement<TProps, TSchema>;

  // ── Overflow ─────────────────────────────────────────────────────────────
  /** overflow-auto */
  overflow_auto(): PoseElement<TProps, TSchema>;
  /** overflow-hidden */
  overflow_hidden(): PoseElement<TProps, TSchema>;
  /** overflow-clip */
  overflow_clip(): PoseElement<TProps, TSchema>;
  /** overflow-visible */
  overflow_visible(): PoseElement<TProps, TSchema>;
  /** overflow-scroll */
  overflow_scroll(): PoseElement<TProps, TSchema>;
  /** overflow-x-auto */
  overflow_x_auto(): PoseElement<TProps, TSchema>;
  /** overflow-x-hidden */
  overflow_x_hidden(): PoseElement<TProps, TSchema>;
  /** overflow-x-clip */
  overflow_x_clip(): PoseElement<TProps, TSchema>;
  /** overflow-x-visible */
  overflow_x_visible(): PoseElement<TProps, TSchema>;
  /** overflow-x-scroll */
  overflow_x_scroll(): PoseElement<TProps, TSchema>;
  /** overflow-y-auto */
  overflow_y_auto(): PoseElement<TProps, TSchema>;
  /** overflow-y-hidden */
  overflow_y_hidden(): PoseElement<TProps, TSchema>;
  /** overflow-y-clip */
  overflow_y_clip(): PoseElement<TProps, TSchema>;
  /** overflow-y-visible */
  overflow_y_visible(): PoseElement<TProps, TSchema>;
  /** overflow-y-scroll */
  overflow_y_scroll(): PoseElement<TProps, TSchema>;

  // ── Colours ──────────────────────────────────────────────────────────────
  /** bg-{color} */
  bg(color: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** bg-opacity-{value} */
  bg_opacity(value: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** text-{color} */
  text_color(color: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** opacity-{value} */
  opacity(value: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;

  // ── Background ───────────────────────────────────────────────────────────
  /** bg-clip-{value}: border | padding | content | text */
  bg_clip(
    value: Dyn<TProps, "border" | "padding" | "content" | "text">,
  ): PoseElement<TProps, TSchema>;
  /** bg-{size}: auto | cover | contain */
  bg_size(value: Dyn<TProps, "auto" | "cover" | "contain">): PoseElement<TProps, TSchema>;
  /** bg-{position}: center | top | bottom | left | right | etc */
  bg_position(value: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** bg-repeat / bg-no-repeat / bg-repeat-x / bg-repeat-y */
  bg_repeat(
    value?: Dyn<TProps, "x" | "y" | "round" | "space" | "none">,
  ): PoseElement<TProps, TSchema>;
  /** bg-attachment: fixed | local | scroll */
  bg_attachment(value: Dyn<TProps, "fixed" | "local" | "scroll">): PoseElement<TProps, TSchema>;
  /** bg-gradient-to-{dir}: t | tr | r | br | b | bl | l | tl */
  bg_gradient(
    dir: Dyn<TProps, "t" | "tr" | "r" | "br" | "b" | "bl" | "l" | "tl">,
  ): PoseElement<TProps, TSchema>;
  /** from-{color} */
  from(color: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** via-{color} */
  via(color: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** to-{color} */
  to(color: Dyn<TProps, string>): PoseElement<TProps, TSchema>;

  // ── Border ───────────────────────────────────────────────────────────────
  /** border (all sides, 1px) */
  border(): PoseElement<TProps, TSchema>;
  /** border-{n} */
  border_w(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** border-t / border-t-{n} */
  border_t(n?: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** border-r / border-r-{n} */
  border_r(n?: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** border-b / border-b-{n} */
  border_b(n?: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** border-l / border-l-{n} */
  border_l(n?: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** border-x-{n} */
  border_x(n?: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** border-y-{n} */
  border_y(n?: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** border-{color} */
  border_color(color: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** border-solid */
  border_solid(): PoseElement<TProps, TSchema>;
  /** border-dashed */
  border_dashed(): PoseElement<TProps, TSchema>;
  /** border-dotted */
  border_dotted(): PoseElement<TProps, TSchema>;
  /** border-double */
  border_double(): PoseElement<TProps, TSchema>;
  /** border-none */
  border_none(): PoseElement<TProps, TSchema>;
  /** border-collapse */
  border_collapse(): PoseElement<TProps, TSchema>;
  /** border-separate */
  border_separate(): PoseElement<TProps, TSchema>;
  /** rounded / rounded-{size} */
  rounded(size?: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** rounded-full */
  rounded_full(): PoseElement<TProps, TSchema>;
  /** rounded-t-{size} */
  rounded_t(size?: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** rounded-r-{size} */
  rounded_r(size?: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** rounded-b-{size} */
  rounded_b(size?: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** rounded-l-{size} */
  rounded_l(size?: Dyn<TProps, string>): PoseElement<TProps, TSchema>;

  // ── Divide ───────────────────────────────────────────────────────────────
  /** divide-x-{n} — border between horizontal children */
  divide_x(n?: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** divide-y-{n} — border between vertical children */
  divide_y(n?: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** divide-x-reverse */
  divide_x_reverse(): PoseElement<TProps, TSchema>;
  /** divide-y-reverse */
  divide_y_reverse(): PoseElement<TProps, TSchema>;
  /** divide-{color} */
  divide_color(color: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** divide-solid */
  divide_solid(): PoseElement<TProps, TSchema>;
  /** divide-dashed */
  divide_dashed(): PoseElement<TProps, TSchema>;
  /** divide-dotted */
  divide_dotted(): PoseElement<TProps, TSchema>;
  /** divide-none */
  divide_none(): PoseElement<TProps, TSchema>;

  // ── Ring (focus/outline rings) ───────────────────────────────────────────
  /** ring */
  ring(): PoseElement<TProps, TSchema>;
  /** ring-{n} */
  ring_w(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** ring-inset */
  ring_inset(): PoseElement<TProps, TSchema>;
  /** ring-{color} */
  ring_color(color: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** ring-offset-{n} */
  ring_offset(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** ring-offset-{color} */
  ring_offset_color(color: Dyn<TProps, string>): PoseElement<TProps, TSchema>;

  // ── Outline ──────────────────────────────────────────────────────────────
  /** outline-none */
  outline_none(): PoseElement<TProps, TSchema>;
  /** outline */
  outline(): PoseElement<TProps, TSchema>;
  /** outline-dashed */
  outline_dashed(): PoseElement<TProps, TSchema>;
  /** outline-dotted */
  outline_dotted(): PoseElement<TProps, TSchema>;
  /** outline-double */
  outline_double(): PoseElement<TProps, TSchema>;
  /** outline-{color} */
  outline_color(color: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** outline-{n} */
  outline_w(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** outline-offset-{n} */
  outline_offset(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;

  // ── Shadow ───────────────────────────────────────────────────────────────
  /** shadow */
  shadow(): PoseElement<TProps, TSchema>;
  /** shadow-sm */
  shadow_sm(): PoseElement<TProps, TSchema>;
  /** shadow-md */
  shadow_md(): PoseElement<TProps, TSchema>;
  /** shadow-lg */
  shadow_lg(): PoseElement<TProps, TSchema>;
  /** shadow-xl */
  shadow_xl(): PoseElement<TProps, TSchema>;
  /** shadow-2xl */
  shadow_2xl(): PoseElement<TProps, TSchema>;
  /** shadow-inner */
  shadow_inner(): PoseElement<TProps, TSchema>;
  /** shadow-none */
  shadow_none(): PoseElement<TProps, TSchema>;
  /** shadow-{color} */
  shadow_color(color: Dyn<TProps, string>): PoseElement<TProps, TSchema>;

  // ── Typography ───────────────────────────────────────────────────────────
  /** text-{size} */
  text(size: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  text_xs(): PoseElement<TProps, TSchema>;
  text_sm(): PoseElement<TProps, TSchema>;
  text_base(): PoseElement<TProps, TSchema>;
  text_lg(): PoseElement<TProps, TSchema>;
  text_xl(): PoseElement<TProps, TSchema>;
  text_2xl(): PoseElement<TProps, TSchema>;
  text_3xl(): PoseElement<TProps, TSchema>;
  text_4xl(): PoseElement<TProps, TSchema>;
  text_5xl(): PoseElement<TProps, TSchema>;
  text_6xl(): PoseElement<TProps, TSchema>;
  text_7xl(): PoseElement<TProps, TSchema>;
  text_8xl(): PoseElement<TProps, TSchema>;
  text_9xl(): PoseElement<TProps, TSchema>;
  /** font-{weight} */
  font_thin(): PoseElement<TProps, TSchema>;
  font_extralight(): PoseElement<TProps, TSchema>;
  font_light(): PoseElement<TProps, TSchema>;
  font_normal(): PoseElement<TProps, TSchema>;
  font_medium(): PoseElement<TProps, TSchema>;
  font_semibold(): PoseElement<TProps, TSchema>;
  font_bold(): PoseElement<TProps, TSchema>;
  font_extrabold(): PoseElement<TProps, TSchema>;
  font_black(): PoseElement<TProps, TSchema>;
  /** italic */
  italic(): PoseElement<TProps, TSchema>;
  /** not-italic */
  not_italic(): PoseElement<TProps, TSchema>;
  /** text-left */
  text_left(): PoseElement<TProps, TSchema>;
  /** text-center */
  text_center(): PoseElement<TProps, TSchema>;
  /** text-right */
  text_right(): PoseElement<TProps, TSchema>;
  /** text-justify */
  text_justify(): PoseElement<TProps, TSchema>;
  /** text-wrap */
  text_wrap(): PoseElement<TProps, TSchema>;
  /** text-nowrap */
  text_nowrap(): PoseElement<TProps, TSchema>;
  /** text-balance */
  text_balance(): PoseElement<TProps, TSchema>;
  /** text-pretty */
  text_pretty(): PoseElement<TProps, TSchema>;
  /** truncate */
  truncate(): PoseElement<TProps, TSchema>;
  /** text-ellipsis */
  text_ellipsis(): PoseElement<TProps, TSchema>;
  /** text-clip */
  text_clip(): PoseElement<TProps, TSchema>;
  /** leading-{value} */
  leading(value: Dyn<TProps, string | number>): PoseElement<TProps, TSchema>;
  /** tracking-{value} */
  tracking(value: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** line-clamp-{n} */
  line_clamp(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** whitespace-{value}: normal | nowrap | pre | pre-line | pre-wrap | break-spaces */
  whitespace(value: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** break-normal */
  break_normal(): PoseElement<TProps, TSchema>;
  /** break-words */
  break_words(): PoseElement<TProps, TSchema>;
  /** break-all */
  break_all(): PoseElement<TProps, TSchema>;
  /** break-keep */
  break_keep(): PoseElement<TProps, TSchema>;
  /** uppercase */
  uppercase(): PoseElement<TProps, TSchema>;
  /** lowercase */
  lowercase(): PoseElement<TProps, TSchema>;
  /** capitalize */
  capitalize(): PoseElement<TProps, TSchema>;
  /** normal-case */
  normal_case(): PoseElement<TProps, TSchema>;
  /** underline */
  underline(): PoseElement<TProps, TSchema>;
  /** overline */
  overline(): PoseElement<TProps, TSchema>;
  /** line-through */
  line_through(): PoseElement<TProps, TSchema>;
  /** no-underline */
  no_underline(): PoseElement<TProps, TSchema>;
  /** decoration-{color} */
  decoration_color(color: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** indent-{n} */
  indent(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** align-{value}: baseline | top | middle | bottom | text-top | text-bottom | sub | super */
  align(value: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** font-{family}: sans | serif | mono */
  font_family(family: Dyn<TProps, "sans" | "serif" | "mono">): PoseElement<TProps, TSchema>;

  // ── List ─────────────────────────────────────────────────────────────────
  /** list-none */
  list_none(): PoseElement<TProps, TSchema>;
  /** list-disc */
  list_disc(): PoseElement<TProps, TSchema>;
  /** list-decimal */
  list_decimal(): PoseElement<TProps, TSchema>;
  /** list-inside */
  list_inside(): PoseElement<TProps, TSchema>;
  /** list-outside */
  list_outside(): PoseElement<TProps, TSchema>;

  // ── Object fit / position ────────────────────────────────────────────────
  /** object-contain */
  object_contain(): PoseElement<TProps, TSchema>;
  /** object-cover */
  object_cover(): PoseElement<TProps, TSchema>;
  /** object-fill */
  object_fill(): PoseElement<TProps, TSchema>;
  /** object-none */
  object_none(): PoseElement<TProps, TSchema>;
  /** object-scale-down */
  object_scale_down(): PoseElement<TProps, TSchema>;
  /** object-{position}: center | top | bottom | left | right | etc */
  object_position(value: Dyn<TProps, string>): PoseElement<TProps, TSchema>;

  // ── Transforms ───────────────────────────────────────────────────────────
  /** scale-{n} */
  scale(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** scale-x-{n} */
  scale_x(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** scale-y-{n} */
  scale_y(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** rotate-{n} */
  rotate(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** translate-x-{n} */
  translate_x(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** translate-y-{n} */
  translate_y(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** skew-x-{n} */
  skew_x(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** skew-y-{n} */
  skew_y(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** origin-{value}: center | top | top-right | right | bottom-right | bottom | bottom-left | left | top-left */
  origin(value: Dyn<TProps, string>): PoseElement<TProps, TSchema>;

  // ── Filters ──────────────────────────────────────────────────────────────
  /** blur / blur-{size} */
  blur(size?: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** brightness-{n} */
  brightness(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** contrast-{n} */
  contrast(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** grayscale / grayscale-0 */
  grayscale(n?: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** hue-rotate-{n} */
  hue_rotate(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** invert / invert-0 */
  invert(n?: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** saturate-{n} */
  saturate(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** sepia / sepia-0 */
  sepia(n?: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** drop-shadow / drop-shadow-{size} */
  drop_shadow(size?: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** backdrop-blur / backdrop-blur-{size} */
  backdrop_blur(size?: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** backdrop-brightness-{n} */
  backdrop_brightness(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;

  // ── Animation ────────────────────────────────────────────────────────────
  /** animate-none */
  animate_none(): PoseElement<TProps, TSchema>;
  /** animate-spin */
  animate_spin(): PoseElement<TProps, TSchema>;
  /** animate-ping */
  animate_ping(): PoseElement<TProps, TSchema>;
  /** animate-pulse */
  animate_pulse(): PoseElement<TProps, TSchema>;
  /** animate-bounce */
  animate_bounce(): PoseElement<TProps, TSchema>;
  /** transition */
  transition(): PoseElement<TProps, TSchema>;
  /** transition-{property}: none | all | colors | opacity | shadow | transform */
  transition_prop(prop: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** duration-{n} */
  duration(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** delay-{n} */
  delay(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;
  /** ease-{value}: linear | in | out | in-out */
  ease(value: Dyn<TProps, "linear" | "in" | "out" | "in-out">): PoseElement<TProps, TSchema>;
  /** will-change-{value}: auto | scroll | contents | transform */
  will_change(value: Dyn<TProps, string>): PoseElement<TProps, TSchema>;

  // ── Interactivity ────────────────────────────────────────────────────────
  /** cursor-auto */
  cursor_auto(): PoseElement<TProps, TSchema>;
  /** cursor-default */
  cursor_default(): PoseElement<TProps, TSchema>;
  /** cursor-pointer */
  cursor_pointer(): PoseElement<TProps, TSchema>;
  /** cursor-wait */
  cursor_wait(): PoseElement<TProps, TSchema>;
  /** cursor-text */
  cursor_text(): PoseElement<TProps, TSchema>;
  /** cursor-move */
  cursor_move(): PoseElement<TProps, TSchema>;
  /** cursor-not-allowed */
  cursor_not_allowed(): PoseElement<TProps, TSchema>;
  /** cursor-grab */
  cursor_grab(): PoseElement<TProps, TSchema>;
  /** cursor-grabbing */
  cursor_grabbing(): PoseElement<TProps, TSchema>;
  /** cursor-crosshair */
  cursor_crosshair(): PoseElement<TProps, TSchema>;
  /** select-none */
  select_none(): PoseElement<TProps, TSchema>;
  /** select-text */
  select_text(): PoseElement<TProps, TSchema>;
  /** select-all */
  select_all(): PoseElement<TProps, TSchema>;
  /** select-auto */
  select_auto(): PoseElement<TProps, TSchema>;
  /** resize-none */
  resize_none(): PoseElement<TProps, TSchema>;
  /** resize */
  resize(): PoseElement<TProps, TSchema>;
  /** resize-x */
  resize_x(): PoseElement<TProps, TSchema>;
  /** resize-y */
  resize_y(): PoseElement<TProps, TSchema>;
  /** pointer-events-none */
  pointer_events_none(): PoseElement<TProps, TSchema>;
  /** pointer-events-auto */
  pointer_events_auto(): PoseElement<TProps, TSchema>;
  /** touch-auto */
  touch_auto(): PoseElement<TProps, TSchema>;
  /** touch-none */
  touch_none(): PoseElement<TProps, TSchema>;
  /** touch-pan-x */
  touch_pan_x(): PoseElement<TProps, TSchema>;
  /** touch-pan-y */
  touch_pan_y(): PoseElement<TProps, TSchema>;
  /** touch-manipulation */
  touch_manipulation(): PoseElement<TProps, TSchema>;
  /** appearance-none */
  appearance_none(): PoseElement<TProps, TSchema>;

  // ── Mix blend ────────────────────────────────────────────────────────────
  /** mix-blend-{mode} */
  mix_blend(mode: Dyn<TProps, string>): PoseElement<TProps, TSchema>;

  // ── SVG ──────────────────────────────────────────────────────────────────
  /** fill-{color} */
  fill(color: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** stroke-{color} */
  stroke(color: Dyn<TProps, string>): PoseElement<TProps, TSchema>;
  /** stroke-{n} */
  stroke_w(n: Dyn<TProps, number | string>): PoseElement<TProps, TSchema>;

  // ── Accessibility ────────────────────────────────────────────────────────
  /** sr-only */
  sr_only(): PoseElement<TProps, TSchema>;
  /** not-sr-only */
  not_sr_only(): PoseElement<TProps, TSchema>;

  // ── Pattern matching ─────────────────────────────────────────────────────

  /**
   * Apply styles conditionally — predicate form or value-switch form.
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
   * Cases are Partial — unmatched values emit no classes.
   * Multiple .when() calls are independent and all evaluated at render time.
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

  // ── Escape hatch ─────────────────────────────────────────────────────────
  /**
   * Append any raw Tailwind class — static or derived from props.
   * @example
   * .cls('hover:opacity-75')
   * .cls(({ active }) => active ? 'ring-2 ring-blue-500' : '')
   */
  cls(value: Dyn<TProps, string>): PoseElement<TProps, TSchema>;

  // ── Children ─────────────────────────────────────────────────────────────
  child(fn: (props: TProps) => ChildValue): PoseElement<TProps, TSchema>;
  child(value: ChildValue): PoseElement<TProps, TSchema>;

  /**
   * Render to `{ html, css }` using UnoCSS + presetWind4.
   * @example
   * const { html, css } = await card.render({ name: 'Ada' })
   */
  render(
    props?: CallArgs<TProps, TSchema>[0],
    opts?: { generatorOptions?: Partial<GenerateOptions<false>> },
  ): Promise<{ html: string; css: string }>;
}

export interface Pose {
  as<Tag extends keyof HTMLElementTagNameMap>(
    tag: Tag,
  ): PoseElement<Record<never, never>, undefined>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tw(prefix: string, value: number | string): string {
  return `${prefix}-${value}`;
}

function arbitrary(value: string): string {
  return /^[\w./#%-]+$/.test(value) ? value : `[${value}]`;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

interface BuilderState<TProps extends Record<string, unknown>> {
  tag: string;
  classes: ClassEntry<TProps>[];
  children: Child<TProps>[];
  schema: StandardSchemaV1 | undefined;
}

function resolveClasses<TProps>(classes: ReadonlyArray<ClassEntry<TProps>>, props: TProps): string {
  return classes
    .map((c) => (typeof c === "function" ? c(props) : c))
    .filter(Boolean)
    .join(" ");
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

/** A tagless builder used inside .when() callbacks — only accumulates classes. */
function createBlankBuilder<TProps extends Record<string, unknown>>(): PoseElement<
  TProps,
  undefined
> {
  return createBuilder<TProps, undefined>({
    tag: "div",
    classes: [],
    children: [],
    schema: undefined,
  });
}

function createBuilder<
  TProps extends Record<string, unknown>,
  TSchema extends StandardSchemaV1 | undefined = undefined,
>(state: BuilderState<TProps>): PoseElement<TProps, TSchema> {
  function derive(
    extraClasses: ClassEntry<TProps>[] = [],
    extraChildren: Child<TProps>[] = [],
  ): PoseElement<TProps, TSchema> {
    return createBuilder<TProps, TSchema>({
      ...state,
      classes: [...state.classes, ...extraClasses],
      children: [...state.children, ...extraChildren],
    });
  }

  function cls(name: string) {
    return derive([name]);
  }

  function dynCls<T>(raw: Dyn<TProps, T>, map: (v: T) => string): PoseElement<TProps, TSchema> {
    if (typeof raw === "function") {
      const fn = raw as (p: TProps) => T;
      return derive([(props: TProps) => map(fn(props))]);
    }
    return derive([map(raw as T)]);
  }

  function buildHtml(resolvedProps: TProps): string {
    const classStr = resolveClasses(state.classes, resolvedProps);
    const childrenStr = state.children
      .map((c) => renderChild(c, resolvedProps as Record<string, unknown>))
      .join("");
    const classAttr = classStr ? ` class="${classStr}"` : "";
    return `<${state.tag}${classAttr}>${childrenStr}</${state.tag}>`;
  }

  function render(...args: CallArgs<TProps, TSchema>): any {
    const props = (args[0] ?? {}) as TProps;
    if (!state.schema) return buildHtml(props);
    const result = runSchema(state.schema, props);
    if (result instanceof Promise) return result.then((v) => buildHtml(v as TProps));
    return buildHtml(result as TProps);
  }

  (render as any).__pose = true;

  const el = render as PoseElement<TProps, TSchema>;

  Object.defineProperty(el, "classes", { get: () => state.classes, enumerable: true });

  el.input = <S extends StandardSchemaV1<any, Record<string, unknown>>>(schema: S) =>
    createBuilder<StandardSchemaV1.InferOutput<S>, S>({
      tag: state.tag,
      classes: state.classes as unknown as ClassEntry<StandardSchemaV1.InferOutput<S>>[],
      children: state.children as unknown as Child<StandardSchemaV1.InferOutput<S>>[],
      schema,
    });

  // Display
  el.block = () => cls("block");
  el.inline = () => cls("inline");
  el.inline_block = () => cls("inline-block");
  el.flex = () => cls("flex");
  el.inline_flex = () => cls("inline-flex");
  el.grid = () => cls("grid");
  el.inline_grid = () => cls("inline-grid");
  el.flow_root = () => cls("flow-root");
  el.hidden = () => cls("hidden");
  el.contents = () => cls("contents");
  el.table = () => cls("table");
  el.table_caption = () => cls("table-caption");
  el.table_cell = () => cls("table-cell");
  el.table_column = () => cls("table-column");
  el.table_column_group = () => cls("table-column-group");
  el.table_footer_group = () => cls("table-footer-group");
  el.table_header_group = () => cls("table-header-group");
  el.table_row_group = () => cls("table-row-group");
  el.table_row = () => cls("table-row");

  // Flexbox
  el.flex_row = () => cls("flex-row");
  el.flex_row_reverse = () => cls("flex-row-reverse");
  el.flex_col = () => cls("flex-col");
  el.flex_col_reverse = () => cls("flex-col-reverse");
  el.flex_wrap = () => cls("flex-wrap");
  el.flex_wrap_reverse = () => cls("flex-wrap-reverse");
  el.flex_nowrap = () => cls("flex-nowrap");
  el.flex_1 = () => cls("flex-1");
  el.flex_auto = () => cls("flex-auto");
  el.flex_initial = () => cls("flex-initial");
  el.flex_none = () => cls("flex-none");
  el.grow = () => cls("grow");
  el.grow_0 = () => cls("grow-0");
  el.shrink = () => cls("shrink");
  el.shrink_0 = () => cls("shrink-0");
  el.order = (n) => dynCls(n, (v) => tw("order", v));
  el.order_first = () => cls("order-first");
  el.order_last = () => cls("order-last");
  el.order_none = () => cls("order-none");

  // Grid
  el.grid_cols = (n) => dynCls(n, (v) => tw("grid-cols", v));
  el.grid_rows = (n) => dynCls(n, (v) => tw("grid-rows", v));
  el.col_span = (n) => dynCls(n, (v) => tw("col-span", v));
  el.col_start = (n) => dynCls(n, (v) => tw("col-start", v));
  el.col_end = (n) => dynCls(n, (v) => tw("col-end", v));
  el.row_span = (n) => dynCls(n, (v) => tw("row-span", v));
  el.row_start = (n) => dynCls(n, (v) => tw("row-start", v));
  el.row_end = (n) => dynCls(n, (v) => tw("row-end", v));
  el.grid_flow_row = () => cls("grid-flow-row");
  el.grid_flow_col = () => cls("grid-flow-col");
  el.grid_flow_dense = () => cls("grid-flow-dense");
  el.auto_cols = (v) => dynCls(v, (s) => tw("auto-cols", s));
  el.auto_rows = (v) => dynCls(v, (s) => tw("auto-rows", s));

  // Alignment
  el.justify_start = () => cls("justify-start");
  el.justify_end = () => cls("justify-end");
  el.justify_center = () => cls("justify-center");
  el.justify_between = () => cls("justify-between");
  el.justify_around = () => cls("justify-around");
  el.justify_evenly = () => cls("justify-evenly");
  el.justify_items_start = () => cls("justify-items-start");
  el.justify_items_end = () => cls("justify-items-end");
  el.justify_items_center = () => cls("justify-items-center");
  el.justify_items_stretch = () => cls("justify-items-stretch");
  el.justify_self_auto = () => cls("justify-self-auto");
  el.justify_self_start = () => cls("justify-self-start");
  el.justify_self_end = () => cls("justify-self-end");
  el.justify_self_center = () => cls("justify-self-center");
  el.justify_self_stretch = () => cls("justify-self-stretch");
  el.items_start = () => cls("items-start");
  el.items_end = () => cls("items-end");
  el.items_center = () => cls("items-center");
  el.items_stretch = () => cls("items-stretch");
  el.items_baseline = () => cls("items-baseline");
  el.self_auto = () => cls("self-auto");
  el.self_start = () => cls("self-start");
  el.self_end = () => cls("self-end");
  el.self_center = () => cls("self-center");
  el.self_stretch = () => cls("self-stretch");
  el.self_baseline = () => cls("self-baseline");
  el.content_start = () => cls("content-start");
  el.content_end = () => cls("content-end");
  el.content_center = () => cls("content-center");
  el.content_between = () => cls("content-between");
  el.content_around = () => cls("content-around");
  el.content_evenly = () => cls("content-evenly");
  el.place_content = (v) => dynCls(v, (s) => tw("place-content", s));
  el.place_items = (v) => dynCls(v, (s) => tw("place-items", s));
  el.place_self = (v) => dynCls(v, (s) => tw("place-self", s));

  // Spacing
  el.gap = (n) => dynCls(n, (v) => tw("gap", v));
  el.gap_0 = () => cls("gap-0");
  el.gap_1 = () => cls("gap-1");
  el.gap_2 = () => cls("gap-2");
  el.gap_3 = () => cls("gap-3");
  el.gap_4 = () => cls("gap-4");
  el.gap_5 = () => cls("gap-5");
  el.gap_6 = () => cls("gap-6");
  el.gap_7 = () => cls("gap-7");
  el.gap_8 = () => cls("gap-8");
  el.gap_x = (n) => dynCls(n, (v) => tw("gap-x", v));
  el.gap_y = (n) => dynCls(n, (v) => tw("gap-y", v));
  el.space_x = (n) => dynCls(n, (v) => tw("space-x", v));
  el.space_y = (n) => dynCls(n, (v) => tw("space-y", v));
  el.space_x_reverse = () => cls("space-x-reverse");
  el.space_y_reverse = () => cls("space-y-reverse");
  el.p = (n) => dynCls(n, (v) => tw("p", v));
  el.px = (n) => dynCls(n, (v) => tw("px", v));
  el.py = (n) => dynCls(n, (v) => tw("py", v));
  el.pt = (n) => dynCls(n, (v) => tw("pt", v));
  el.pr = (n) => dynCls(n, (v) => tw("pr", v));
  el.pb = (n) => dynCls(n, (v) => tw("pb", v));
  el.pl = (n) => dynCls(n, (v) => tw("pl", v));
  el.m = (n) => dynCls(n, (v) => tw("m", v));
  el.mx = (n) => dynCls(n, (v) => tw("mx", v));
  el.my = (n) => dynCls(n, (v) => tw("my", v));
  el.mt = (n) => dynCls(n, (v) => tw("mt", v));
  el.mr = (n) => dynCls(n, (v) => tw("mr", v));
  el.mb = (n) => dynCls(n, (v) => tw("mb", v));
  el.ml = (n) => dynCls(n, (v) => tw("ml", v));
  el.m_auto = () => cls("m-auto");
  el.mx_auto = () => cls("mx-auto");
  el.my_auto = () => cls("my-auto");

  // Sizing
  el.size = (n) => dynCls(n, (v) => tw("size", v));
  el.w = (n) => dynCls(n, (v) => tw("w", v));
  el.w_full = () => cls("w-full");
  el.w_screen = () => cls("w-screen");
  el.w_min = () => cls("w-min");
  el.w_max = () => cls("w-max");
  el.w_fit = () => cls("w-fit");
  el.h = (n) => dynCls(n, (v) => tw("h", v));
  el.h_full = () => cls("h-full");
  el.h_screen = () => cls("h-screen");
  el.h_min = () => cls("h-min");
  el.h_max = () => cls("h-max");
  el.h_fit = () => cls("h-fit");
  el.min_w = (n) => dynCls(n, (v) => tw("min-w", v));
  el.max_w = (n) => dynCls(n, (v) => tw("max-w", v));
  el.min_h = (n) => dynCls(n, (v) => tw("min-h", v));
  el.max_h = (n) => dynCls(n, (v) => tw("max-h", v));
  el.aspect = (v) => dynCls(v, (s) => tw("aspect", s));
  el.aspect_auto = () => cls("aspect-auto");
  el.aspect_square = () => cls("aspect-square");
  el.aspect_video = () => cls("aspect-video");

  // Position
  el.static_pos = () => cls("static");
  el.relative = () => cls("relative");
  el.absolute = () => cls("absolute");
  el.fixed = () => cls("fixed");
  el.sticky = () => cls("sticky");
  el.inset = (n) => dynCls(n, (v) => tw("inset", v));
  el.inset_0 = () => cls("inset-0");
  el.inset_x = (n) => dynCls(n, (v) => tw("inset-x", v));
  el.inset_y = (n) => dynCls(n, (v) => tw("inset-y", v));
  el.top = (n) => dynCls(n, (v) => tw("top", v));
  el.right = (n) => dynCls(n, (v) => tw("right", v));
  el.bottom = (n) => dynCls(n, (v) => tw("bottom", v));
  el.left = (n) => dynCls(n, (v) => tw("left", v));
  el.z = (n) => dynCls(n, (v) => tw("z", v));

  // Visibility
  el.visible = () => cls("visible");
  el.invisible = () => cls("invisible");

  // Float & clear
  el.float_left = () => cls("float-left");
  el.float_right = () => cls("float-right");
  el.float_none = () => cls("float-none");
  el.clear_left = () => cls("clear-left");
  el.clear_right = () => cls("clear-right");
  el.clear_both = () => cls("clear-both");
  el.clear_none = () => cls("clear-none");

  // Box sizing
  el.box_border = () => cls("box-border");
  el.box_content = () => cls("box-content");

  // Overflow
  el.overflow_auto = () => cls("overflow-auto");
  el.overflow_hidden = () => cls("overflow-hidden");
  el.overflow_clip = () => cls("overflow-clip");
  el.overflow_visible = () => cls("overflow-visible");
  el.overflow_scroll = () => cls("overflow-scroll");
  el.overflow_x_auto = () => cls("overflow-x-auto");
  el.overflow_x_hidden = () => cls("overflow-x-hidden");
  el.overflow_x_clip = () => cls("overflow-x-clip");
  el.overflow_x_visible = () => cls("overflow-x-visible");
  el.overflow_x_scroll = () => cls("overflow-x-scroll");
  el.overflow_y_auto = () => cls("overflow-y-auto");
  el.overflow_y_hidden = () => cls("overflow-y-hidden");
  el.overflow_y_clip = () => cls("overflow-y-clip");
  el.overflow_y_visible = () => cls("overflow-y-visible");
  el.overflow_y_scroll = () => cls("overflow-y-scroll");

  // Colours
  el.bg = (c) => dynCls(c, (v) => `bg-${arbitrary(v)}`);
  el.bg_opacity = (v) => dynCls(v, (n) => tw("bg-opacity", n));
  el.text_color = (c) => dynCls(c, (v) => `text-${arbitrary(v)}`);
  el.opacity = (v) => dynCls(v, (n) => tw("opacity", n));

  // Background
  el.bg_clip = (v) => dynCls(v, (s) => `bg-clip-${s}`);
  el.bg_size = (v) => dynCls(v, (s) => `bg-${s}`);
  el.bg_position = (v) => dynCls(v, (s) => `bg-${s}`);
  el.bg_repeat = (v) =>
    v !== undefined
      ? dynCls(v, (s) => (s === "none" ? "bg-no-repeat" : `bg-repeat-${s}`))
      : cls("bg-repeat");
  el.bg_attachment = (v) => dynCls(v, (s) => `bg-${s}`);
  el.bg_gradient = (dir) => dynCls(dir, (d) => `bg-gradient-to-${d}`);
  el.from = (c) => dynCls(c, (v) => `from-${arbitrary(v)}`);
  el.via = (c) => dynCls(c, (v) => `via-${arbitrary(v)}`);
  el.to = (c) => dynCls(c, (v) => `to-${arbitrary(v)}`);

  // Border
  el.border = () => cls("border");
  el.border_w = (n) => dynCls(n, (v) => tw("border", v));
  el.border_t = (n) => (n !== undefined ? dynCls(n, (v) => tw("border-t", v)) : cls("border-t"));
  el.border_r = (n) => (n !== undefined ? dynCls(n, (v) => tw("border-r", v)) : cls("border-r"));
  el.border_b = (n) => (n !== undefined ? dynCls(n, (v) => tw("border-b", v)) : cls("border-b"));
  el.border_l = (n) => (n !== undefined ? dynCls(n, (v) => tw("border-l", v)) : cls("border-l"));
  el.border_x = (n) => (n !== undefined ? dynCls(n, (v) => tw("border-x", v)) : cls("border-x"));
  el.border_y = (n) => (n !== undefined ? dynCls(n, (v) => tw("border-y", v)) : cls("border-y"));
  el.border_color = (c) => dynCls(c, (v) => `border-${arbitrary(v)}`);
  el.border_solid = () => cls("border-solid");
  el.border_dashed = () => cls("border-dashed");
  el.border_dotted = () => cls("border-dotted");
  el.border_double = () => cls("border-double");
  el.border_none = () => cls("border-none");
  el.border_collapse = () => cls("border-collapse");
  el.border_separate = () => cls("border-separate");
  el.rounded = (s) => (s !== undefined ? dynCls(s, (v) => `rounded-${v}`) : cls("rounded"));
  el.rounded_full = () => cls("rounded-full");
  el.rounded_t = (s) => (s !== undefined ? dynCls(s, (v) => `rounded-t-${v}`) : cls("rounded-t"));
  el.rounded_r = (s) => (s !== undefined ? dynCls(s, (v) => `rounded-r-${v}`) : cls("rounded-r"));
  el.rounded_b = (s) => (s !== undefined ? dynCls(s, (v) => `rounded-b-${v}`) : cls("rounded-b"));
  el.rounded_l = (s) => (s !== undefined ? dynCls(s, (v) => `rounded-l-${v}`) : cls("rounded-l"));

  // Divide
  el.divide_x = (n) => (n !== undefined ? dynCls(n, (v) => tw("divide-x", v)) : cls("divide-x"));
  el.divide_y = (n) => (n !== undefined ? dynCls(n, (v) => tw("divide-y", v)) : cls("divide-y"));
  el.divide_x_reverse = () => cls("divide-x-reverse");
  el.divide_y_reverse = () => cls("divide-y-reverse");
  el.divide_color = (c) => dynCls(c, (v) => `divide-${arbitrary(v)}`);
  el.divide_solid = () => cls("divide-solid");
  el.divide_dashed = () => cls("divide-dashed");
  el.divide_dotted = () => cls("divide-dotted");
  el.divide_none = () => cls("divide-none");

  // Ring
  el.ring = () => cls("ring");
  el.ring_w = (n) => dynCls(n, (v) => tw("ring", v));
  el.ring_inset = () => cls("ring-inset");
  el.ring_color = (c) => dynCls(c, (v) => `ring-${arbitrary(v)}`);
  el.ring_offset = (n) => dynCls(n, (v) => tw("ring-offset", v));
  el.ring_offset_color = (c) => dynCls(c, (v) => `ring-offset-${arbitrary(v)}`);

  // Outline
  el.outline_none = () => cls("outline-none");
  el.outline = () => cls("outline");
  el.outline_dashed = () => cls("outline-dashed");
  el.outline_dotted = () => cls("outline-dotted");
  el.outline_double = () => cls("outline-double");
  el.outline_color = (c) => dynCls(c, (v) => `outline-${arbitrary(v)}`);
  el.outline_w = (n) => dynCls(n, (v) => tw("outline", v));
  el.outline_offset = (n) => dynCls(n, (v) => tw("outline-offset", v));

  // Shadow
  el.shadow = () => cls("shadow");
  el.shadow_sm = () => cls("shadow-sm");
  el.shadow_md = () => cls("shadow-md");
  el.shadow_lg = () => cls("shadow-lg");
  el.shadow_xl = () => cls("shadow-xl");
  el.shadow_2xl = () => cls("shadow-2xl");
  el.shadow_inner = () => cls("shadow-inner");
  el.shadow_none = () => cls("shadow-none");
  el.shadow_color = (c) => dynCls(c, (v) => `shadow-${arbitrary(v)}`);

  // Typography
  el.text = (s) => dynCls(s, (v) => `text-${v}`);
  el.text_xs = () => cls("text-xs");
  el.text_sm = () => cls("text-sm");
  el.text_base = () => cls("text-base");
  el.text_lg = () => cls("text-lg");
  el.text_xl = () => cls("text-xl");
  el.text_2xl = () => cls("text-2xl");
  el.text_3xl = () => cls("text-3xl");
  el.text_4xl = () => cls("text-4xl");
  el.text_5xl = () => cls("text-5xl");
  el.text_6xl = () => cls("text-6xl");
  el.text_7xl = () => cls("text-7xl");
  el.text_8xl = () => cls("text-8xl");
  el.text_9xl = () => cls("text-9xl");
  el.font_thin = () => cls("font-thin");
  el.font_extralight = () => cls("font-extralight");
  el.font_light = () => cls("font-light");
  el.font_normal = () => cls("font-normal");
  el.font_medium = () => cls("font-medium");
  el.font_semibold = () => cls("font-semibold");
  el.font_bold = () => cls("font-bold");
  el.font_extrabold = () => cls("font-extrabold");
  el.font_black = () => cls("font-black");
  el.italic = () => cls("italic");
  el.not_italic = () => cls("not-italic");
  el.text_left = () => cls("text-left");
  el.text_center = () => cls("text-center");
  el.text_right = () => cls("text-right");
  el.text_justify = () => cls("text-justify");
  el.text_wrap = () => cls("text-wrap");
  el.text_nowrap = () => cls("text-nowrap");
  el.text_balance = () => cls("text-balance");
  el.text_pretty = () => cls("text-pretty");
  el.truncate = () => cls("truncate");
  el.text_ellipsis = () => cls("text-ellipsis");
  el.text_clip = () => cls("text-clip");
  el.leading = (v) => dynCls(v, (n) => tw("leading", n));
  el.tracking = (v) => dynCls(v, (n) => tw("tracking", n));
  el.line_clamp = (n) => dynCls(n, (v) => tw("line-clamp", v));
  el.whitespace = (v) => dynCls(v, (s) => tw("whitespace", s));
  el.break_normal = () => cls("break-normal");
  el.break_words = () => cls("break-words");
  el.break_all = () => cls("break-all");
  el.break_keep = () => cls("break-keep");
  el.uppercase = () => cls("uppercase");
  el.lowercase = () => cls("lowercase");
  el.capitalize = () => cls("capitalize");
  el.normal_case = () => cls("normal-case");
  el.underline = () => cls("underline");
  el.overline = () => cls("overline");
  el.line_through = () => cls("line-through");
  el.no_underline = () => cls("no-underline");
  el.decoration_color = (c) => dynCls(c, (v) => `decoration-${arbitrary(v)}`);
  el.indent = (n) => dynCls(n, (v) => tw("indent", v));
  el.align = (v) => dynCls(v, (s) => tw("align", s));
  el.font_family = (v) => dynCls(v, (s) => tw("font", s));

  // List
  el.list_none = () => cls("list-none");
  el.list_disc = () => cls("list-disc");
  el.list_decimal = () => cls("list-decimal");
  el.list_inside = () => cls("list-inside");
  el.list_outside = () => cls("list-outside");

  // Object fit/position
  el.object_contain = () => cls("object-contain");
  el.object_cover = () => cls("object-cover");
  el.object_fill = () => cls("object-fill");
  el.object_none = () => cls("object-none");
  el.object_scale_down = () => cls("object-scale-down");
  el.object_position = (v) => dynCls(v, (s) => `object-${s}`);

  // Transforms
  el.scale = (n) => dynCls(n, (v) => tw("scale", v));
  el.scale_x = (n) => dynCls(n, (v) => tw("scale-x", v));
  el.scale_y = (n) => dynCls(n, (v) => tw("scale-y", v));
  el.rotate = (n) => dynCls(n, (v) => tw("rotate", v));
  el.translate_x = (n) => dynCls(n, (v) => tw("translate-x", v));
  el.translate_y = (n) => dynCls(n, (v) => tw("translate-y", v));
  el.skew_x = (n) => dynCls(n, (v) => tw("skew-x", v));
  el.skew_y = (n) => dynCls(n, (v) => tw("skew-y", v));
  el.origin = (v) => dynCls(v, (s) => tw("origin", s));

  // Filters
  el.blur = (s) => (s !== undefined ? dynCls(s, (v) => tw("blur", v)) : cls("blur"));
  el.brightness = (n) => dynCls(n, (v) => tw("brightness", v));
  el.contrast = (n) => dynCls(n, (v) => tw("contrast", v));
  el.grayscale = (n) => (n !== undefined ? dynCls(n, (v) => tw("grayscale", v)) : cls("grayscale"));
  el.hue_rotate = (n) => dynCls(n, (v) => tw("hue-rotate", v));
  el.invert = (n) => (n !== undefined ? dynCls(n, (v) => tw("invert", v)) : cls("invert"));
  el.saturate = (n) => dynCls(n, (v) => tw("saturate", v));
  el.sepia = (n) => (n !== undefined ? dynCls(n, (v) => tw("sepia", v)) : cls("sepia"));
  el.drop_shadow = (s) =>
    s !== undefined ? dynCls(s, (v) => tw("drop-shadow", v)) : cls("drop-shadow");
  el.backdrop_blur = (s) =>
    s !== undefined ? dynCls(s, (v) => tw("backdrop-blur", v)) : cls("backdrop-blur");
  el.backdrop_brightness = (n) => dynCls(n, (v) => tw("backdrop-brightness", v));

  // Animation
  el.animate_none = () => cls("animate-none");
  el.animate_spin = () => cls("animate-spin");
  el.animate_ping = () => cls("animate-ping");
  el.animate_pulse = () => cls("animate-pulse");
  el.animate_bounce = () => cls("animate-bounce");
  el.transition = () => cls("transition");
  el.transition_prop = (p) => dynCls(p, (v) => `transition-${v}`);
  el.duration = (n) => dynCls(n, (v) => tw("duration", v));
  el.delay = (n) => dynCls(n, (v) => tw("delay", v));
  el.ease = (v) => dynCls(v, (s) => tw("ease", s));
  el.will_change = (v) => dynCls(v, (s) => tw("will-change", s));

  // Interactivity
  el.cursor_auto = () => cls("cursor-auto");
  el.cursor_default = () => cls("cursor-default");
  el.cursor_pointer = () => cls("cursor-pointer");
  el.cursor_wait = () => cls("cursor-wait");
  el.cursor_text = () => cls("cursor-text");
  el.cursor_move = () => cls("cursor-move");
  el.cursor_not_allowed = () => cls("cursor-not-allowed");
  el.cursor_grab = () => cls("cursor-grab");
  el.cursor_grabbing = () => cls("cursor-grabbing");
  el.cursor_crosshair = () => cls("cursor-crosshair");
  el.select_none = () => cls("select-none");
  el.select_text = () => cls("select-text");
  el.select_all = () => cls("select-all");
  el.select_auto = () => cls("select-auto");
  el.resize_none = () => cls("resize-none");
  el.resize = () => cls("resize");
  el.resize_x = () => cls("resize-x");
  el.resize_y = () => cls("resize-y");
  el.pointer_events_none = () => cls("pointer-events-none");
  el.pointer_events_auto = () => cls("pointer-events-auto");
  el.touch_auto = () => cls("touch-auto");
  el.touch_none = () => cls("touch-none");
  el.touch_pan_x = () => cls("touch-pan-x");
  el.touch_pan_y = () => cls("touch-pan-y");
  el.touch_manipulation = () => cls("touch-manipulation");
  el.appearance_none = () => cls("appearance-none");

  // Mix blend
  el.mix_blend = (mode) => dynCls(mode, (v) => tw("mix-blend", v));

  // SVG
  el.fill = (c) => dynCls(c, (v) => `fill-${arbitrary(v)}`);
  el.stroke = (c) => dynCls(c, (v) => `stroke-${arbitrary(v)}`);
  el.stroke_w = (n) => dynCls(n, (v) => tw("stroke", v));

  // Accessibility
  el.sr_only = () => cls("sr-only");
  el.not_sr_only = () => cls("not-sr-only");

  // Pattern matching
  el.when = (...args: any[]): any => {
    if (typeof args[0] === "function") {
      // Predicate form: when(pred, apply)
      const [pred, apply] = args as [
        (props: TProps) => boolean,
        (b: PoseElement<TProps, undefined>) => PoseElement<TProps, any>,
      ];
      return derive([
        (props: TProps) => {
          if (!pred(props)) return "";
          return resolveClasses(apply(createBlankBuilder<TProps>()).classes, props);
        },
      ]);
    } else {
      // Value form: when(key, cases)
      const [key, cases] = args as [
        keyof TProps,
        Record<PropertyKey, (b: PoseElement<TProps, undefined>) => PoseElement<TProps, any>>,
      ];
      return derive([
        (props: TProps) => {
          const value = props[key] as PropertyKey;
          const branch = cases[value];
          if (!branch) return "";
          return resolveClasses(branch(createBlankBuilder<TProps>()).classes, props);
        },
      ]);
    }
  };

  // Escape hatch
  el.cls = (value) => (typeof value === "function" ? derive([value]) : derive([value]));

  // Render to { html, css }
  el.render = async (
    props?: CallArgs<TProps, TSchema>[0],
    opts?: { generatorOptions?: Partial<GenerateOptions<false>> },
  ) => {
    const html = (render as any)(props);
    const resolvedHtml = html instanceof Promise ? await html : html;
    const generator = await getGenerator();
    const { css } = await generator.generate(resolvedHtml, opts?.generatorOptions);
    return { html: resolvedHtml, css };
  };

  // Children
  el.child = (value: any) =>
    createBuilder<TProps, TSchema>({
      ...state,
      classes: [...state.classes],
      children: [...state.children, value],
    });

  return el;
}

// ---------------------------------------------------------------------------
// CSS generation via UnoCSS
// ---------------------------------------------------------------------------

let _generator: UnoGenerator | undefined = undefined;

async function getGenerator() {
  if (_generator) return _generator;
  const { createGenerator } = await import("@unocss/core");
  const { default: presetWind4 } = await import("@unocss/preset-wind4");
  _generator = await createGenerator({ presets: [presetWind4()] });
  return _generator;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const pose: Pose = {
  as(tag) {
    return createBuilder({ tag, classes: [], children: [], schema: undefined });
  },
};

export const div = pose.as("div");

export default pose;
