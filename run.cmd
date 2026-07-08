@echo off
REM ============================================================
REM  NEXUS AI - Global RUN command (Windows)
REM  Type `run` from project root = start with TUNNEL (public URL).
REM  Type `bun run dev` = start Next.js ONLY (no tunnel, localhost).
REM ============================================================

call "%~dp0scripts\run-local.bat" %*
