import ReactDOM from "react-dom/client";
import { initializeMockApi } from "@/lib/api-bridge";
import "./app.css";
import App from "./app";

// Initialize the mock API before rendering
initializeMockApi();

const root = document.getElementById("root");

if (!root) {
  throw new Error("PiDesk web root was not found");
}

ReactDOM.createRoot(root).render(<App />);
