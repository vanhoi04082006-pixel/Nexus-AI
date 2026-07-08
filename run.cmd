@echo off
REM ============================================================
REM  NEXUS AI - Global RUN command (Windows)
REM  Type `run` from project root to start the whole system.
REM  Delegates to scripts/run.js (cross-platform, self-contained).
REM ============================================================

node "%~dp0scripts\run.js" %*
