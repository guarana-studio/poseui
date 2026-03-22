import { createStore } from "@poseui/store";
import { createPose } from "poseui";
import { reactive } from "poseui/presets/reactive";
import { tailwind4 } from "poseui/presets/tailwind4";
import { z } from "zod";

export const pose = createPose({ presets: [tailwind4, reactive] });

export const store = createStore((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

export const app = pose
  .as("div")
  .input(z.object({ count: z.number().default(0) }))
  .child(
    ({ count }) => `
      <span>${count}</span>
      <button id="incrementButton" class="bg-neutral-900 text-neutral-100 p-2">+</button>
    `,
  )
  .on("#incrementButton", "click", () => store.getState().increment())
  .watch(store, (s) => ({ count: s.count }));
