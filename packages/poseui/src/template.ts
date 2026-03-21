// =============================================================================
// html`` tagged template literal
//
// Composes PoseElements (and raw values) into a larger HTML structure while
// preserving the props-threading contract of the core engine.
//
// Usage:
//
//   import { html } from "poseui";
//
//   const loginCard = html<Props>`
//     <div ${card}>
//       <header>
//         <h2>Login to your account</h2>
//       </header>
//       <section>
//         <form ${loginForm}>
//           <label ${emailLabel}>Email</label>
//           <input ${emailInput} />
//         </form>
//       </section>
//       <footer ${cardFooter}>
//         <button ${loginBtn}>Login</button>
//         <button ${googleBtn}>Login with Google</button>
//       </footer>
//     </div>
//   `;
//
//   loginCard({ user: "Ada" }); // → full HTML string
//
// Interpolation slots accept:
//   • PoseElement  — rendered with the template's current props
//   • (props) => string | null | undefined  — called with current props
//   • string | number | null | undefined  — inserted literally
//
// When a PoseElement is interpolated into an *opening tag position* (i.e. the
// interpolation appears between `<tagName ` and `>`), its resolved class string
// and attributes are merged into that tag — mirroring the ${card} spread idiom
// shown in the screenshot.  In all other positions the element is fully rendered.
// =============================================================================

import type { PoseElement } from "./"; // adjust to your actual import path

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Non-callable structural view of PoseElement used inside Slot<>.
 *
 * PoseElement has a call signature (...args) => string. When it appears in a
 * union alongside a function type ((props: TProps) => ...), TypeScript merges
 * the call signatures and the contextual type for callback parameters widens
 * to `any`, causing TS7031 "implicitly has any type" errors.
 *
 * Using only the `__pose` brand here — with no call signature — keeps the two
 * callable members of the union fully separate so TypeScript can propagate
 * TProps into destructured callback parameters correctly.
 */
type PoseElementRef = { readonly __pose: true };

/** A single interpolation slot in an html`` template. */
export type Slot<TProps extends Record<string, unknown>> =
  | PoseElementRef
  | ((props: TProps) => string | null | undefined)
  | string
  | number
  | null
  | undefined;

/** The function returned by html`…` */
export type Template<TProps extends Record<string, unknown>> = {
  (props?: Partial<TProps>): string;
  readonly _isTemplate: true;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** True when a value is a PoseElement (callable + __pose marker). */
function isPoseElement(v: unknown): v is PoseElement<any, any, any> {
  return typeof v === "function" && (v as any).__pose === true;
}

/**
 * Resolve a slot value to a string fragment given the current props.
 * When `asAttrSpread` is true the PoseElement's class + attrs are extracted
 * without the wrapping tag (for the opening-tag-position idiom).
 */
function resolveSlot<TProps extends Record<string, unknown>>(
  slot: Slot<TProps>,
  props: TProps,
  asAttrSpread: boolean,
): string {
  if (slot == null) return "";

  if (isPoseElement(slot)) {
    if (asAttrSpread) {
      // Extract only the class and attribute string from this element's state.
      // We render a "dummy" version and peel out the internals via __state.
      return extractAttrsFromElement(slot, props);
    }
    // Full render — pass props through so child elements stay reactive.
    return (slot as Function)(props);
  }

  if (typeof slot === "function") {
    const result = (slot as (p: TProps) => string | null | undefined)(props);
    return result == null ? "" : String(result);
  }

  return String(slot);
}

/**
 * Given a PoseElement, render ONLY its `class="…"` and attribute fragments
 * (no outer tag, no children) so they can be spliced into a parent opening tag.
 *
 * We call into the same internal helpers that `createBuilder` uses, accessed
 * via the `__state` reference stored on every element.
 */
function extractAttrsFromElement(
  el: PoseElement<any, any, any>,
  props: Record<string, unknown>,
): string {
  const state = (el as any).__state as {
    classes: ReadonlyArray<string | ((p: unknown) => string)>;
    attrs: ReadonlyArray<
      | ["single", string, string | ((p: unknown) => string | null)]
      | ["record", (p: unknown) => Record<string, string | null>]
    >;
  };

  const parts: string[] = [];

  // classes
  const classStr = state.classes
    .map((c) => (typeof c === "function" ? c(props) : c))
    .filter(Boolean)
    .join(" ");
  if (classStr) parts.push(`class="${classStr}"`);

  // attrs
  for (const entry of state.attrs) {
    if (entry[0] === "single") {
      const [, name, value] = entry;
      const resolved = typeof value === "function" ? value(props) : value;
      if (resolved === null) continue;
      parts.push(resolved === "" ? name : `${name}="${resolved}"`);
    } else {
      const [, fn] = entry;
      for (const [name, value] of Object.entries(fn(props))) {
        if (value === null) continue;
        parts.push(value === "" ? name : `${name}="${value}"`);
      }
    }
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Opening-tag detection
// ---------------------------------------------------------------------------

/**
 * Returns true when the *preceding* static string fragment ends with an
 * opening-tag context, meaning the slot should be treated as an attribute
 * spread rather than a full child render.
 *
 * We look for the pattern:  `<tagName` followed by optional whitespace, with
 * no closing `>` between the tag start and the interpolation point.
 *
 * Examples where this fires:
 *   `<div ${el}>…`         preceding = "…<div "
 *   `<button class="x" ${el}>` preceding = "…<button class=\"x\" "
 *
 * Examples where it does NOT fire:
 *   `<div>${el}</div>`     preceding ends with ">"
 */
function isOpeningTagPosition(preceding: string): boolean {
  // Find the last `<` that hasn't been closed by a `>`.
  const lastOpen = preceding.lastIndexOf("<");
  if (lastOpen === -1) return false;
  const afterOpen = preceding.slice(lastOpen);
  // If there's a closing `>` after the last `<`, we're outside any tag.
  if (afterOpen.includes(">")) return false;
  // Must look like an element opening, not a closing tag `</…`.
  return !/^<\//.test(afterOpen);
}

// ---------------------------------------------------------------------------
// Core builder
// ---------------------------------------------------------------------------

/**
 * Build the compiled template function.
 *
 * We walk the static strings and slots once to produce a render function that
 * re-evaluates dynamic slots on every call.
 */
function compileTemplate<TProps extends Record<string, unknown>>(
  strings: TemplateStringsArray,
  slots: ReadonlyArray<Slot<TProps>>,
): Template<TProps> {
  function render(props?: Partial<TProps>): string {
    const p = (props ?? {}) as TProps;
    let out = "";

    for (let i = 0; i < strings.length; i++) {
      out += strings[i];

      if (i < slots.length) {
        const slot = slots[i];
        const asSpread = isOpeningTagPosition(out);
        const fragment = resolveSlot(slot, p, asSpread);

        if (asSpread) {
          if (fragment) {
            // Ensure exactly one space between existing tag content and our attrs.
            if (!/\s$/.test(out)) out += " ";
          } else {
            // Nothing to spread — eat the trailing whitespace the static string
            // already contributed so we don't leave a double-space in the tag.
            out = out.trimEnd();
          }
        }

        out += fragment;
      }
    }

    return out.trim();
  }

  (render as any)._isTemplate = true as const;
  return render as Template<TProps>;
}

// ---------------------------------------------------------------------------
// Tagged template literal overloads
// ---------------------------------------------------------------------------

/**
 * `html` without a type parameter — props are inferred as `Record<string, unknown>`.
 *
 *   const el = html`<div>${someElement}</div>`;
 *   el(); // → "<div>…</div>"
 */
export function html(
  strings: TemplateStringsArray,
  ...slots: Slot<Record<string, unknown>>[]
): Template<Record<string, unknown>>;

/**
 * `html` with an explicit props type.
 *
 *   const el = html<{ name: string }>`<p>${({ name }) => name}</p>`;
 *   el({ name: "Ada" }); // → "<p>Ada</p>"
 */
export function html<TProps extends Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...slots: Slot<TProps>[]
): Template<TProps>;

export function html<TProps extends Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...slots: Slot<TProps>[]
): Template<TProps> {
  return compileTemplate<TProps>(strings, slots);
}

// ---------------------------------------------------------------------------
// Utility: nest a Template inside another template as a slot
// ---------------------------------------------------------------------------

/**
 * Wrap a compiled Template so it can be used as a slot inside another html``
 * template, with props threaded through.
 *
 *   const inner = html<Props>`<span>${({ name }) => name}</span>`;
 *   const outer = html<Props>`<div>${slot(inner)}</div>`;
 *
 * Without `slot()` wrapping, a Template (which is just a function) would be
 * called as a dynamic slot with the current props — which actually works
 * already if the Template accepts a compatible props shape!  `slot()` is
 * provided as an explicit, self-documenting alias.
 */
export function slot<TProps extends Record<string, unknown>>(
  template: Template<TProps>,
): (props: TProps) => string {
  return (props: TProps) => template(props);
}
