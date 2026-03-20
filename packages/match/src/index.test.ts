// =============================================================================
// @poseui/match — test suite
// Run with: bun test
// =============================================================================

import { describe, it, expect } from "bun:test";
import { match } from "./index";

// ---------------------------------------------------------------------------
// match()
// ---------------------------------------------------------------------------

describe("match()", () => {
  it("returns a builder with when, all, first, last, resolve", () => {
    const builder = match({ x: 1 });
    expect(typeof builder.when).toBe("function");
    expect(typeof builder.all).toBe("function");
    expect(typeof builder.first).toBe("function");
    expect(typeof builder.last).toBe("function");
    expect(typeof builder.resolve).toBe("function");
  });

  it("is immutable — each .when() returns a new builder", () => {
    const a = match({ x: 1 });
    const b = a.when(({ x }) => x === 1, "hit");
    expect(a).not.toBe(b);
    // original builder is unaffected — it has no matchers
    expect(a.all()).toEqual([]);
    expect(b.all()).toEqual(["hit"]);
  });
});

// ---------------------------------------------------------------------------
// .when() — predicate form
// ---------------------------------------------------------------------------

describe(".when() predicate form", () => {
  it("matches when predicate returns true", () => {
    const result = match({ disabled: true })
      .when(({ disabled }) => disabled, "opacity-50")
      .all();
    expect(result).toEqual(["opacity-50"]);
  });

  it("does not match when predicate returns false", () => {
    const result = match({ disabled: false })
      .when(({ disabled }) => disabled, "opacity-50")
      .all();
    expect(result).toEqual([]);
  });

  it("accepts a result function — receives the full input value", () => {
    const result = match({ count: 7 })
      .when(
        ({ count }) => count > 0,
        ({ count }) => `${count} items`,
      )
      .first();
    expect(result).toBe("7 items");
  });

  it("evaluates multi-field predicates", () => {
    const result = match({ variant: "primary", disabled: false })
      .when(({ variant, disabled }) => variant === "primary" && !disabled, "bg-indigo-600")
      .first();
    expect(result).toBe("bg-indigo-600");
  });

  it("multiple predicate whens are all evaluated independently", () => {
    const result = match({ bold: true, italic: true, underline: false })
      .when(({ bold }) => bold, "font-bold")
      .when(({ italic }) => italic, "italic")
      .when(({ underline }) => underline, "underline")
      .all();
    expect(result).toEqual(["font-bold", "italic"]);
  });

  it("is chainable — returns a MatchBuilder", () => {
    const builder = match({ x: 1 }).when(() => true, "a");
    expect(typeof builder.when).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// .when() — key switch form
// ---------------------------------------------------------------------------

describe(".when() key switch form", () => {
  it("matches the correct case", () => {
    const result = match({ variant: "primary" })
      .when("variant", {
        primary: "bg-indigo-600 text-white",
        secondary: "bg-slate-200 text-slate-900",
      })
      .first();
    expect(result).toBe("bg-indigo-600 text-white");
  });

  it("matches each case independently", () => {
    expect(
      match({ variant: "secondary" })
        .when("variant", { primary: "bg-indigo-600", secondary: "bg-slate-200" })
        .first(),
    ).toBe("bg-slate-200");
  });

  it("emits nothing for an unhandled case (Partial)", () => {
    const result = match({ variant: "ghost" as string })
      .when("variant", { primary: "bg-indigo-600", secondary: "bg-slate-200" })
      .all();
    expect(result).toEqual([]);
  });

  it("accepts a result function — receives the full input value", () => {
    const result = match({ size: "lg", base: 4 })
      .when("size", {
        sm: ({ base }) => `p-${base / 2}`,
        lg: ({ base }) => `p-${base * 2}`,
      })
      .first();
    expect(result).toBe("p-8");
  });

  it("multiple key whens are all evaluated independently", () => {
    const result = match({ variant: "primary", size: "sm" })
      .when("variant", {
        primary: "bg-indigo-600 text-white",
        secondary: "bg-slate-200 text-slate-900",
      })
      .when("size", {
        sm: "px-2 py-1 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg",
      })
      .all();
    expect(result).toEqual(["bg-indigo-600 text-white", "px-2 py-1 text-sm"]);
  });

  it("is chainable — returns a MatchBuilder", () => {
    const builder = match({ x: "a" }).when("x", { a: "hit" });
    expect(typeof builder.when).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// Mixed predicate + key switch
// ---------------------------------------------------------------------------

describe("mixed .when() calls", () => {
  it("evaluates predicate and key matchers in registration order", () => {
    const result = match({ variant: "primary", disabled: true })
      .when("variant", {
        primary: "bg-indigo-600 text-white",
        secondary: "bg-slate-200 text-slate-900",
      })
      .when(({ disabled }) => disabled, "opacity-50 cursor-not-allowed")
      .all();
    expect(result).toEqual(["bg-indigo-600 text-white", "opacity-50 cursor-not-allowed"]);
  });

  it("preserves order — predicate first, then key", () => {
    const result = match({ variant: "secondary", flag: true })
      .when(({ flag }) => flag, "first")
      .when("variant", { secondary: "second" })
      .all();
    expect(result).toEqual(["first", "second"]);
  });

  it("full real-world example — button props to class string", () => {
    const props: {
      variant: "primary" | "secondary";
      size: "sm" | "md" | "lg";
      disabled: boolean;
    } = { variant: "primary", size: "lg", disabled: true };

    const classes = match(props)
      .when("variant", {
        primary: "bg-indigo-600 text-white",
        secondary: "bg-slate-200 text-slate-900",
      })
      .when("size", {
        sm: "px-2 py-1 text-sm",
        md: "px-4 py-2 text-base",
        lg: "px-6 py-3 text-lg",
      })
      .when(({ disabled }) => disabled, "opacity-50 cursor-not-allowed")
      .resolve();

    expect(classes).toBe(
      "bg-indigo-600 text-white px-6 py-3 text-lg opacity-50 cursor-not-allowed",
    );
  });
});

// ---------------------------------------------------------------------------
// .all()
// ---------------------------------------------------------------------------

describe(".all()", () => {
  it("returns an empty array when nothing matches", () => {
    expect(
      match({ x: false })
        .when(({ x }) => x, "hit")
        .all(),
    ).toEqual([]);
  });

  it("returns all matched results in order", () => {
    const result = match({ a: true, b: true, c: false })
      .when(({ a }) => a, "A")
      .when(({ b }) => b, "B")
      .when(({ c }) => c, "C")
      .all();
    expect(result).toEqual(["A", "B"]);
  });

  it("can return multiple results from key matchers", () => {
    const result = match({ x: "foo", y: "bar" })
      .when("x", { foo: "matched-x" })
      .when("y", { bar: "matched-y" })
      .all();
    expect(result).toEqual(["matched-x", "matched-y"]);
  });

  it("is non-destructive — can be called multiple times with the same result", () => {
    const builder = match({ x: true }).when(({ x }) => x, "hit");
    expect(builder.all()).toEqual(["hit"]);
    expect(builder.all()).toEqual(["hit"]);
  });
});

// ---------------------------------------------------------------------------
// .first()
// ---------------------------------------------------------------------------

describe(".first()", () => {
  it("returns undefined when nothing matches", () => {
    expect(
      match({ x: false })
        .when(({ x }) => x, "hit")
        .first(),
    ).toBeUndefined();
  });

  it("returns only the first matched result", () => {
    const result = match({ a: true, b: true })
      .when(({ a }) => a, "A")
      .when(({ b }) => b, "B")
      .first();
    expect(result).toBe("A");
  });

  it("skips non-matching matchers before finding the first match", () => {
    const result = match({ a: false, b: true })
      .when(({ a }) => a, "A")
      .when(({ b }) => b, "B")
      .first();
    expect(result).toBe("B");
  });

  it("works with a single matcher", () => {
    expect(match({ x: "ok" }).when("x", { ok: "found" }).first()).toBe("found");
  });
});

// ---------------------------------------------------------------------------
// .last()
// ---------------------------------------------------------------------------

describe(".last()", () => {
  it("returns undefined when nothing matches", () => {
    expect(
      match({ x: false })
        .when(({ x }) => x, "hit")
        .last(),
    ).toBeUndefined();
  });

  it("returns only the last matched result", () => {
    const result = match({ a: true, b: true })
      .when(({ a }) => a, "A")
      .when(({ b }) => b, "B")
      .last();
    expect(result).toBe("B");
  });

  it("skips matchers after the last match", () => {
    const result = match({ a: true, b: false })
      .when(({ a }) => a, "A")
      .when(({ b }) => b, "B")
      .last();
    expect(result).toBe("A");
  });

  it("with a single match, first and last return the same value", () => {
    const builder = match({ x: "sm" }).when("x", { sm: "text-sm" });
    expect(builder.first()).toBe(builder.last());
  });
});

// ---------------------------------------------------------------------------
// .resolve()
// ---------------------------------------------------------------------------

describe(".resolve()", () => {
  it("returns an empty string when nothing matches and TOut is string", () => {
    const result = match({ x: false })
      .when(({ x }) => x, "hit")
      .resolve();
    expect(result).toBe("");
  });

  it("joins all string results with a space", () => {
    const result = match({ a: true, b: true })
      .when(({ a }) => a, "font-bold")
      .when(({ b }) => b, "italic")
      .resolve();
    expect(result).toBe("font-bold italic");
  });

  it("returns a single match without extra spaces", () => {
    const result = match({ variant: "primary" })
      .when("variant", { primary: "bg-indigo-600 text-white" })
      .resolve();
    expect(result).toBe("bg-indigo-600 text-white");
  });

  it("does not add leading or trailing spaces", () => {
    const result = match({ a: false, b: true, c: false })
      .when(({ a }) => a, "A")
      .when(({ b }) => b, "B")
      .when(({ c }) => c, "C")
      .resolve();
    expect(result).toBe("B");
    expect(result.startsWith(" ")).toBe(false);
    expect(result.endsWith(" ")).toBe(false);
  });

  it("returns an array when TOut is not string", () => {
    const result = match<{ x: boolean }, number>({ x: true })
      .when(({ x }) => x, 42)
      .resolve();
    expect(result).toEqual([42]);
  });

  it("is non-destructive — can be called multiple times with the same result", () => {
    const builder = match({ a: true, b: true })
      .when(({ a }) => a, "A")
      .when(({ b }) => b, "B");
    expect(builder.resolve()).toBe("A B");
    expect(builder.resolve()).toBe("A B");
  });
});

// ---------------------------------------------------------------------------
// Result functions
// ---------------------------------------------------------------------------

describe("result functions", () => {
  it("predicate form — result function receives the full input value", () => {
    const result = match<{ multiplier: number; base: number }, number>({ multiplier: 3, base: 10 })
      .when(
        ({ multiplier }) => multiplier > 1,
        ({ multiplier, base }) => multiplier * base,
      )
      .first();
    expect(result).toBe(30);
  });

  it("key switch form — result function receives the full input value", () => {
    const result = match<{ size: "sm" | "lg"; scale: number }>({ size: "lg", scale: 4 })
      .when("size", {
        sm: ({ scale }) => `gap-${scale / 2}`,
        lg: ({ scale }) => `gap-${scale * 2}`,
      })
      .first();
    expect(result).toBe("gap-8");
  });

  it("result functions and static results can be mixed in one key switch", () => {
    const result = match({ variant: "dynamic" as string, value: 99 })
      .when("variant", {
        static: "hardcoded-class",
        dynamic: ({ value }) => `opacity-${value}`,
      })
      .first();
    expect(result).toBe("opacity-99");
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  it("no matchers registered — all() returns empty array", () => {
    expect(match({ x: 1 }).all()).toEqual([]);
  });

  it("no matchers registered — first() returns undefined", () => {
    expect(match({ x: 1 }).first()).toBeUndefined();
  });

  it("no matchers registered — last() returns undefined", () => {
    expect(match({ x: 1 }).last()).toBeUndefined();
  });

  it("no matchers registered — resolve() returns empty string", () => {
    expect(match({ x: 1 }).resolve()).toBe("");
  });

  it("handles boolean values via predicate form", () => {
    // boolean is not a valid Record key type in TS — use predicate form instead
    expect(
      match({ active: false })
        .when(({ active }) => active, "ring-2")
        .when(({ active }) => !active, "opacity-50")
        .first(),
    ).toBe("opacity-50");

    expect(
      match({ active: true })
        .when(({ active }) => active, "ring-2")
        .when(({ active }) => !active, "opacity-50")
        .first(),
    ).toBe("ring-2");
  });

  it("handles numeric key cases", () => {
    const result = match({ level: 3 as number })
      .when("level", { 1: "text-sm", 2: "text-base", 3: "text-lg" })
      .first();
    expect(result).toBe("text-lg");
  });

  it("multiple when calls on the same key each fire independently", () => {
    // Two separate .when("variant") blocks both get evaluated
    const result = match({ variant: "a" })
      .when("variant", { a: "first-a" })
      .when("variant", { a: "second-a" })
      .all();
    expect(result).toEqual(["first-a", "second-a"]);
  });

  it("works with deeply nested object values as input", () => {
    const result = match({ user: { role: "admin" }, active: true })
      .when(({ user }) => user.role === "admin", "bg-red-100")
      .when(({ active }) => active, "ring-2")
      .resolve();
    expect(result).toBe("bg-red-100 ring-2");
  });
});
