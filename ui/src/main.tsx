import "./skin/index.css";
import "./app/styles.css";

import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";

const container = document.getElementById("app");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
