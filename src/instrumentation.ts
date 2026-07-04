// NEXUS AI - Instrumentation (Node.js runtime only)
// Runs once when the server starts. Registers global error handlers so the
// server doesn't crash on unhandled promise rejections or uncaught exceptions.

export async function register() {
  // Only register in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  process.on("unhandledRejection", (reason) => {
    console.error(">> [UNHANDLED REJECTION]", reason);
  });

  process.on("uncaughtException", (err) => {
    console.error(">> [UNCAUGHT EXCEPTION]", err.message);
    // Don't exit — keep the server alive
  });
}
