// NEXUS AI — Cross-platform run script
// Detects OS and runs the appropriate local + tunnel script
// Usage: bun run run   (or)   node scripts/run.js

const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const projectDir = path.join(__dirname, "..");
const isWindows = process.platform === "win32";

console.log("╔══════════════════════════════════════════════════════╗");
console.log("║   NEXUS AI — Local Run + Tunnel                      ║");
console.log("╚══════════════════════════════════════════════════════╝");
console.log("");

if (isWindows) {
  // Windows: run .bat file
  const batFile = path.join(projectDir, "scripts", "run-local.bat");
  if (!fs.existsSync(batFile)) {
    console.error("✗ scripts/run-local.bat not found!");
    process.exit(1);
  }
  console.log("▶ Running on Windows:", batFile);
  const child = spawn("cmd.exe", ["/c", batFile], {
    cwd: projectDir,
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", (code) => process.exit(code || 0));
} else {
  // Linux/Mac: run .sh file
  const shFile = path.join(projectDir, "scripts", "run-local.sh");
  if (!fs.existsSync(shFile)) {
    console.error("✗ scripts/run-local.sh not found!");
    process.exit(1);
  }
  console.log("▶ Running on Linux/Mac:", shFile);
  const child = spawn("bash", [shFile], {
    cwd: projectDir,
    stdio: "inherit",
  });
  child.on("exit", (code) => process.exit(code || 0));
}
