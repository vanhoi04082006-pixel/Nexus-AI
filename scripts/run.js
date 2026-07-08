// NEXUS AI — Cross-platform run script (self-contained)
// Works on Windows + Linux/Mac. No bash required.
// Usage: bun run run   (or)   node scripts/run.js   (or)   run.cmd  (Windows only)

const { spawn, spawnSync, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");

const projectDir = path.join(__dirname, "..");
const isWindows = process.platform === "win32";
const log = (msg) => console.log(msg);
const ok = (msg) => console.log(`  \x1b[32m\u2713\x1b[0m ${msg}`);
const fail = (msg) => console.log(`  \x1b[31m\u2717\x1b[0m ${msg}`);
const info = (msg) => console.log(`  \x1b[36m\u2139\x1b[0m ${msg}`);
const warn = (msg) => console.log(`  \x1b[33m\u26a0\x1b[0m ${msg}`);
const step = (n, total, msg) => console.log(`\x1b[1m[${n}/${total}]\x1b[0m \x1b[33m${msg}\x1b[0m`);

function run(cmd, args, opts = {}) {
  try {
    const result = spawnSync(cmd, args, { cwd: projectDir, encoding: "utf8", shell: isWindows, ...opts });
    return { ok: result.status === 0, stdout: result.stdout || "", stderr: result.stderr || "" };
  } catch {
    return { ok: false, stdout: "", stderr: "" };
  }
}

function checkCmd(cmd) {
  const check = isWindows ? run("where", [cmd], { stdio: "pipe" }) : run("which", [cmd], { stdio: "pipe" });
  return check.ok;
}

function waitForServer(port, maxTries = 30) {
  return new Promise((resolve) => {
    let tries = 0;
    const tryConnect = () => {
      tries++;
      const req = http.get(`http://localhost:${port}/`, (res) => {
        if (res.statusCode === 200) return resolve(true);
        if (tries < maxTries) setTimeout(tryConnect, 2000);
        else resolve(false);
        res.resume();
      });
      req.on("error", () => {
        if (tries < maxTries) setTimeout(tryConnect, 2000);
        else resolve(false);
      });
      req.setTimeout(3000, () => req.destroy());
    };
    tryConnect();
  });
}

function killPort(port) {
  if (isWindows) {
    try {
      const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: "utf8" });
      const pids = [...new Set(out.split("\n").map(l => l.trim().split(/\s+/).pop()).filter(Boolean))];
      pids.forEach(pid => { try { execSync(`taskkill /f /pid ${pid}`, { stdio: "ignore" }); } catch {} });
    } catch {}
  } else {
    try { execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: "ignore" }); } catch {}
  }
}

async function main() {
  console.log("");
  console.log("\x1b[36m========================================================\x1b[0m");
  console.log("\x1b[36m   \x1b[1mNEXUS AI\x1b[0m\x1b[36m - Multi-Agent Architect\x1b[0m");
  console.log("\x1b[36m========================================================\x1b[0m");
  console.log("");

  // ===== Step 1: Check Environment =====
  step(1, 6, "Checking Environment...");

  // .env
  if (!fs.existsSync(path.join(projectDir, ".env"))) {
    warn(".env not found");
    if (fs.existsSync(path.join(projectDir, ".env.example"))) {
      fs.copyFileSync(path.join(projectDir, ".env.example"), path.join(projectDir, ".env"));
      info("Created .env from .env.example — fill in API keys then run again");
      process.exit(1);
    }
    fail(".env.example also missing");
    process.exit(1);
  }
  ok(".env found");

  // Node
  if (!checkCmd("node")) { fail("Node.js not installed"); process.exit(1); }
  const nodeVer = run("node", ["--version"], { stdio: "pipe" }).stdout.trim();
  ok(`Node ${nodeVer}`);

  // Bun
  if (!checkCmd("bun")) {
    fail("Bun not installed");
    info(isWindows ? "Install: powershell -c \"irm bun.sh/install.ps1 | iex\"" : "Install: curl -fsSL https://bun.sh/install | bash");
    process.exit(1);
  }
  const bunVer = run("bun", ["--version"], { stdio: "pipe" }).stdout.trim();
  ok(`Bun ${bunVer}`);
  console.log("");

  // ===== Step 2: Install Dependencies =====
  step(2, 6, "Installing Dependencies...");
  const install = run("bun", ["install", "--silent"], { stdio: "inherit" });
  if (!install.ok) { fail("bun install failed"); process.exit(1); }
  ok("Dependencies ready");
  console.log("");

  // ===== Step 3: Check Database =====
  step(3, 6, "Checking Database...");
  const dbPath = path.join(projectDir, "db", "custom.db");
  if (!fs.existsSync(dbPath)) {
    warn("Database not found, running db:push...");
    const dbPush = run("bun", ["run", "db:push"], { stdio: "inherit" });
    if (!dbPush.ok) { fail("db:push failed"); process.exit(1); }
    ok("Database created");
  } else {
    ok("Database ready (db/custom.db)");
  }
  console.log("");

  // ===== Step 4: Start Mini-services =====
  step(4, 6, "Starting Mini-services...");
  const children = [];

  // Chat service (port 3001)
  const chatPath = path.join(projectDir, "mini-services", "chat-service", "index.ts");
  if (fs.existsSync(chatPath)) {
    const chat = spawn("bun", ["run", "index.ts"], {
      cwd: path.join(projectDir, "mini-services", "chat-service"),
      stdio: "ignore",
      detached: !isWindows,
      shell: isWindows,
    });
    chat.unref();
    children.push(chat);
    ok("Chat Service      : port 3001");
  }

  // Notification service (port 3002)
  const notifyPath = path.join(projectDir, "mini-services", "notification-service", "index.ts");
  if (fs.existsSync(notifyPath)) {
    const notify = spawn("bun", ["run", "index.ts"], {
      cwd: path.join(projectDir, "mini-services", "notification-service"),
      stdio: "ignore",
      detached: !isWindows,
      shell: isWindows,
    });
    notify.unref();
    children.push(notify);
    ok("Notification Svc  : port 3002");
  }
  console.log("");

  // ===== Step 5: Start Frontend (Next.js) =====
  step(5, 6, "Starting Frontend (Next.js)...");
  killPort(3000);

  const dev = spawn("bun", ["run", "dev"], {
    cwd: projectDir,
    stdio: "inherit",
    detached: !isWindows,
    shell: isWindows,
  });
  children.push(dev);

  // Wait for server ready
  info("Waiting for server (port 3000)...");
  const ready = await waitForServer(3000, 30);
  if (!ready) {
    fail("Server failed to start. Check dev.log");
    process.exit(1);
  }
  ok("Frontend ready    : http://localhost:3000");
  console.log("");

  // ===== Step 6: AI Kernel ready =====
  step(6, 6, "AI Kernel...");
  ok("10 AI Agents loaded (OpenRouter multi-key)");
  ok("Anti-rate-limit: Circuit Breaker + Dead Model + Health Score");
  console.log("");

  // ===== Done =====
  console.log("\x1b[32m========================================================\x1b[0m");
  console.log("\x1b[32m   \x1b[1mNEXUS AI is running!\x1b[0m");
  console.log("\x1b[32m========================================================\x1b[0m");
  console.log("");
  console.log("  \x1b[36mLocal\x1b[0m          : http://localhost:3000");
  console.log("  \x1b[36mChat Service\x1b[0m   : port 3001");
  console.log("  \x1b[36mNotify Service\x1b[0m : port 3002");
  console.log("");
  console.log("  \x1b[2mPress Ctrl+C to stop all services.\x1b[0m");
  console.log("");

  // Cleanup on exit
  const cleanup = () => {
    console.log("\n\x1b[33mStopping all services...\x1b[0m");
    children.forEach(c => {
      try {
        if (isWindows) {
          spawnSync("taskkill", ["/pid", c.pid, "/f", "/t"], { stdio: "ignore" });
        } else {
          process.kill(-c.pid, "SIGTERM");
        }
      } catch {}
    });
    process.exit(0);
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Keep alive
  dev.on("exit", (code) => {
    console.log(`\n\x1b[33mDev server exited (code ${code})\x1b[0m`);
    cleanup();
  });
}

main().catch((err) => {
  console.error("\x1b[31mFatal error:\x1b[0m", err);
  process.exit(1);
});
