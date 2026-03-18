import { it, expect } from "bun:test";
import pose, { div } from "./";
import { z } from "zod";

it("creates a div", () => {
  const div = pose.as("div");
  expect(div()).toEqual("<div></div>");
});

it("has a default div export", () => {
  expect(div()).toEqual("<div></div>");
});

it("allows to define children", () => {
  const div = pose.as("div").child("Hello, World!");
  expect(div()).toEqual("<div>Hello, World!</div>");
});

it("allows to define input", () => {
  const div = pose
    .as("div")
    .input(z.object({ name: z.string() }))
    .child(({ name }) => name);
  expect(div({ name: "Johnny" })).toEqual("<div>Johnny</div>");
});

it("allows to define styling variants", () => {
  const button = pose
    .as("button")
    .input(z.object({ variant: z.enum(["primary", "secondary"]).default("primary") }))
    .bg(({ variant }) => (variant === "primary" ? "blue-500" : "neutral-500"));
  expect(button({ variant: "primary" })).toEqual('<button class="bg-blue-500"></button>');
});

it("allows to generate css", async () => {
  const { html, css } = await pose.as("div").bg("blue-500").render();
  expect(html).toEqual('<div class="bg-blue-500"></div>');
  expect(css).toContain(".bg-blue-500{");
});

it("allows to define boolean variant", () => {
  const button = pose
    .as("button")
    .input(z.object({ disabled: z.boolean().default(false) }))
    .when(
      ({ disabled }) => disabled,
      (b) => b.opacity(50).cursor_not_allowed(),
    );
  expect(button({ disabled: true })).toEqual(
    '<button class="opacity-50 cursor-not-allowed"></button>',
  );
});

it("allows to define string variants", () => {
  const button = pose
    .as("button")
    .input(z.object({ variant: z.enum(["primary", "secondary"]).default("primary") }))
    .when("variant", {
      primary: (b) => b.bg("blue-500"),
      secondary: (b) => b.bg("neutral-500"),
    });
  expect(button({ variant: "primary" })).toEqual('<button class="bg-blue-500"></button>');
});
