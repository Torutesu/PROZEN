"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PROZEN] App error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-medium text-destructive uppercase tracking-widest">
            Error
          </p>
          <h2 className="text-xl font-bold tracking-tight">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {error.message ??
              "An unexpected error occurred. Your data is safe."}
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground font-mono">
              ID: {error.digest}
            </p>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <Button size="sm" onClick={reset}>
            Try again
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => (window.location.href = "/")}
          >
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}
