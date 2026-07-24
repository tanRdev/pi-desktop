import { app } from "electron";
import { bootstrapDesktop } from "./bootstrap/bootstrap-desktop";

bootstrapDesktop().catch((err) => {
  console.error("Fatal error during desktop bootstrap:", err);
  app.quit();
});
