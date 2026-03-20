// =============================================================================
// @poseui/match — typed pattern matching utility
// Zero dependencies. Framework agnostic.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Matcher<TIn, TOut> =
  | { kind: "predicate"; pred: (value: TIn) => boolean; result: TOut | ((value: TIn) => TOut) }
  | {
      kind: "key";
      key: keyof TIn;
      cases: Partial<Record<PropertyKey, TOut | ((value: TIn) => TOut)>>;
    };

// ---------------------------------------------------------------------------
// MatchBuilder
// ---------------------------------------------------------------------------

export interface MatchBuilder<TIn, TOut> {
  /**
   * Apply a result when the predicate returns true.
   *
   * @example
   * match({ disabled: true })
   *   .when(({ disabled }) => disabled, "opacity-50 cursor-not-allowed")
   *   .resolve()
   * // → "opacity-50 cursor-not-allowed"
   */
  when(
    pred: (value: TIn) => boolean,
    result: TOut | ((value: TIn) => TOut),
  ): MatchBuilder<TIn, TOut>;

  /**
   * Switch on a key of the input value, applying a result per matching case.
   * Cases are Partial — unmatched values contribute nothing.
   *
   * @example
   * match({ variant: "primary" })
   *   .when("variant", {
   *     primary:   "bg-indigo-600 text-white",
   *     secondary: "bg-slate-200 text-slate-900",
   *   })
   *   .resolve()
   * // → "bg-indigo-600 text-white"
   */
  when<K extends keyof TIn>(
    key: K,
    cases: Partial<Record<TIn[K] & PropertyKey, TOut | ((value: TIn) => TOut)>>,
  ): MatchBuilder<TIn, TOut>;

  /**
   * Evaluate all registered matchers against the input in registration order
   * and return an array of every matched result.
   *
   * @example
   * match({ variant: "primary", disabled: true })
   *   .when("variant", { primary: "bg-indigo-600" })
   *   .when(({ disabled }) => disabled, "opacity-50")
   *   .all()
   * // → ["bg-indigo-600", "opacity-50"]
   */
  all(): TOut[];

  /**
   * Evaluate all registered matchers and return the first matched result,
   * or `undefined` if nothing matched.
   *
   * @example
   * match({ status: "error" })
   *   .when("status", { ok: "text-green-600", error: "text-red-600" })
   *   .first()
   * // → "text-red-600"
   */
  first(): TOut | undefined;

  /**
   * Evaluate all registered matchers and return the last matched result,
   * or `undefined` if nothing matched. Useful when later matchers are
   * intentionally more specific overrides.
   */
  last(): TOut | undefined;

  /**
   * Evaluate all registered matchers. When `TOut` is `string`, joins all
   * matched results with a space — convenient for composing class strings.
   * When `TOut` is not `string`, behaves identically to `.all()`.
   *
   * @example
   * match({ variant: "primary", disabled: true })
   *   .when("variant", { primary: "bg-indigo-600 text-white" })
   *   .when(({ disabled }) => disabled, "opacity-50 cursor-not-allowed")
   *   .resolve()
   * // → "bg-indigo-600 text-white opacity-50 cursor-not-allowed"
   */
  resolve(): TOut extends string ? string : TOut[];
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

function createMatchBuilder<TIn, TOut>(
  value: TIn,
  matchers: Matcher<TIn, TOut>[],
): MatchBuilder<TIn, TOut> {
  function resolveResult(result: TOut | ((value: TIn) => TOut)): TOut {
    return typeof result === "function" ? (result as (value: TIn) => TOut)(value) : result;
  }

  function evaluate(): TOut[] {
    const results: TOut[] = [];
    for (const matcher of matchers) {
      if (matcher.kind === "predicate") {
        if (matcher.pred(value)) {
          results.push(resolveResult(matcher.result));
        }
      } else {
        const caseResult = matcher.cases[value[matcher.key] as PropertyKey];
        if (caseResult !== undefined) {
          results.push(resolveResult(caseResult));
        }
      }
    }
    return results;
  }

  const builder: MatchBuilder<TIn, TOut> = {
    when(...args: any[]): MatchBuilder<TIn, TOut> {
      if (typeof args[0] === "function") {
        const [pred, result] = args as [(value: TIn) => boolean, TOut | ((value: TIn) => TOut)];
        return createMatchBuilder(value, [...matchers, { kind: "predicate", pred, result }]);
      }
      const [key, cases] = args as [
        keyof TIn,
        Partial<Record<PropertyKey, TOut | ((value: TIn) => TOut)>>,
      ];
      return createMatchBuilder(value, [...matchers, { kind: "key", key, cases }]);
    },

    all(): TOut[] {
      return evaluate();
    },

    first(): TOut | undefined {
      return evaluate()[0];
    },

    last(): TOut | undefined {
      const results = evaluate();
      return results[results.length - 1];
    },

    resolve(): any {
      const results = evaluate();
      if (results.length === 0) return typeof "" === "string" ? "" : results;
      if (typeof results[0] === "string") {
        return (results as string[]).join(" ");
      }
      return results;
    },
  };

  return builder;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a typed pattern matcher against a plain object value.
 *
 * Chain `.when()` calls to register matchers, then evaluate with `.resolve()`,
 * `.all()`, `.first()`, or `.last()`.
 *
 * The default `TOut` is `string`, making it ergonomic for composing class
 * strings without a type annotation:
 *
 * @example — class string composition (default TOut = string)
 * const classes = match({ variant: "primary", disabled: true, size: "lg" })
 *   .when("variant", {
 *     primary:   "bg-indigo-600 text-white",
 *     secondary: "bg-slate-200 text-slate-900",
 *   })
 *   .when("size", {
 *     sm: "px-2 py-1 text-sm",
 *     md: "px-4 py-2 text-base",
 *     lg: "px-6 py-3 text-lg",
 *   })
 *   .when(({ disabled }) => disabled, "opacity-50 cursor-not-allowed")
 *   .resolve();
 * // → "bg-indigo-600 text-white px-6 py-3 text-lg opacity-50 cursor-not-allowed"
 *
 * @example — arbitrary value production (explicit TOut)
 * const icon = match<typeof props, ReactNode>({ status: "error" })
 *   .when("status", {
 *     ok:      <CheckIcon />,
 *     error:   <XIcon />,
 *     pending: <SpinnerIcon />,
 *   })
 *   .first();
 */
export function match<TIn extends Record<string, unknown>>(value: TIn): MatchBuilder<TIn, string>;
export function match<TIn extends Record<string, unknown>, TOut>(
  value: TIn,
): MatchBuilder<TIn, TOut>;
export function match<TIn extends Record<string, unknown>>(value: TIn): MatchBuilder<TIn, any> {
  return createMatchBuilder(value, []);
}
