"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PROZEN] Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090b",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
          padding: "16px",
        }}
      >
        <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#f87171",
              marginBottom: 8,
            }}
          >
            Critical Error
          </p>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 12,
              letterSpacing: "-0.02em",
            }}
          >
            Something went seriously wrong
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "#a1a1aa",
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            {error.message ??
              "A fatal error occurred. Please reload the page."}
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                color: "#71717a",
                marginBottom: 24,
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={reset}
              style={{
                padding: "8px 20px",
                background: "#1738BD",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              style={{
                padding: "8px 20px",
                background: "transparent",
                color: "#a1a1aa",
                border: "1px solid #27272a",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Go home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
