import "./app.css";
import "virtual:uno.css";
import { createEventMap } from "@poseui/on";

import { app } from "./app";

const events = createEventMap();

app.mount(document.querySelector("#app")!, events);
