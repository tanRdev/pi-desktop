import ReactDOM from "react-dom/client";
import "./app.css";
import App from "./app";

const root = document.getElementById("root");

if (!root) {
  throw new Error("PiDesk renderer root was not found");
}

ReactDOM.createRoot(root).render(<App />);
