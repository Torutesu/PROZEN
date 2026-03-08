"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Dashboard redirects to the workspace selector.
// Workspace/product management lives at /workspaces.
export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/workspaces");
  }, [router]);

  return null;
}
