import { createPose } from "poseui";
import { reactive } from "poseui/presets/reactive";
import { tailwind4 } from "poseui/presets/tailwind4";

export const pose = createPose({ presets: [tailwind4, reactive] });
