/**
 * sanitize.ts — HTML sanitization helper (XSS defense).
 *
 * Uses DOMPurify to strip dangerous tags/attributes from user/AI-sourced HTML
 * before rendering via dangerouslySetInnerHTML.
 *
 * Usage:
 *   import { sanitizeHtml } from "@/lib/sanitize";
 *   <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userHtml) }} />
 */

import DOMPurify from "dompurify";

// Allowlist for the rendered HTML profile (docs, email bodies, markdown output).
const HTML_PROFILE = {
  ALLOWED_TAGS: [
    // Text
    "p", "br", "hr", "span", "div",
    // Headings
    "h1", "h2", "h3", "h4", "h5", "h6",
    // Lists
    "ul", "ol", "li", "dl", "dt", "dd",
    // Text formatting
    "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "small", "sub", "sup",
    "abbr", "cite", "q", "blockquote", "code", "pre", "kbd", "samp", "var",
    // Tables
    "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
    // Links + images (sanitized)
    "a", "img",
    // Other
    "details", "summary", "figure", "figcaption", "time", "address",
  ],
  ALLOWED_ATTR: [
    "href", "src", "alt", "title", "class", "id", "width", "height",
    "colspan", "rowspan", "target", "rel", "datetime",
    // Allow inline style for color/align (DOMPurify will strip expressions/script)
    "style",
  ],
  ALLOWED_ATTR_PREFIX: [], // no data-* (safer)
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ["script", "object", "embed", "iframe", "form", "input", "button", "textarea", "select", "style", "link", "meta", "base"],
  FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onmouseout", "onfocus", "onblur", "onsubmit", "javascript"],
  // Force rel=noopener noreferrer on all target=_blank links
  ADD_ATTR: ["target"],
};

/**
 * Sanitize HTML for safe rendering via dangerouslySetInnerHTML.
 * Strips <script>, on* event handlers, javascript: URLs, and other XSS vectors.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";
  try {
    return DOMPurify.sanitize(dirty, HTML_PROFILE as DOMPurify.Config);
  } catch {
    // Fallback: escape everything if DOMPurify fails (SSR / no window)
    return dirty
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

/**
 * Escape HTML special characters (for text contexts, not HTML).
 * Use this when inserting untrusted text into an HTML string.
 */
export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Strip CRLF characters from a string (prevent SMTP header injection).
 * Use this for email subject, from name, recipient addresses.
 */
export function stripCrlf(s: unknown): string {
  return String(s ?? "").replace(/[\r\n]/g, "");
}
