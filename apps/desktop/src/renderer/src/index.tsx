import "@fontsource-variable/saira";
import "@fontsource/ubuntu";
import "@fontsource/ibm-plex-mono";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import "./app.css";
import App from "./app";
import { ErrorBoundary } from "./components/error-boundary";
import { ThemeProvider } from "./components/theme-provider";

if (import.meta.env.DEV) {
  import("react-grab");
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Pi Desktop renderer root was not found");
}

ReactDOM.createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);
