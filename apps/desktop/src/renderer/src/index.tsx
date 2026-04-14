import "@fontsource-variable/geist";
import "@fontsource-variable/source-code-pro";
import ReactDOM from "react-dom/client";
import "./app.css";
import App from "./app";

if (import.meta.env.DEV) {
  import("react-grab");
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Pi Desktop renderer root was not found");
}

ReactDOM.createRoot(root).render(<App />);
