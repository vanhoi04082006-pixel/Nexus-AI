// NEXUS AI - Instrumentation (Node.js runtime only)
// Runs once when the server starts. Registers global error handlers so the
// server doesn't crash on unhandled promise rejections or uncaught exceptions.

export async function register() {
  // Only register in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Assign to local variable so Turbopack doesn't statically analyze
  // the Node.js API call (process.on is not supported in Edge Runtime)
  const nodeProcess = process;

  nodeProcess.on("unhandledRejection", (reason: unknown) => {
    console.error(">> [UNHANDLED REJECTION]", reason);
  });

  nodeProcess.on("uncaughtException", (err: Error) => {
    console.error(">> [UNCAUGHT EXCEPTION]", err.message);
    // Don't exit — keep the server alive
  });
}
