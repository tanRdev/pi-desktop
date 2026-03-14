import process from "node:process";

if (process.env.CI) {
  console.log("perf-startup placeholder: CI mode active");
} else {
  console.log(
    "perf-startup placeholder: run after Electron shell implementation",
  );
}
