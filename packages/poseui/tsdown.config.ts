import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/presets/tailwind4/index.ts",
    "src/presets/basecoat/index.ts",
    "src/presets/reactive/index.ts",
    "src/unocss/index.ts",
  ],
  platform: "neutral",
  dts: true,
});
