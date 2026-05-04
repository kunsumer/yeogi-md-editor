import React from "react";
import ReactDOM from "react-dom/client";
import { Preview } from "./Preview";

const params = new URLSearchParams(location.search);
const docId = params.get("docId") ?? "";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Preview docId={docId} />
  </React.StrictMode>,
);
