"use client";

import { use } from "react";
import { AppShell } from "@/components/layout/app-shell";

interface Props {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string; productId: string }>;
}

export default function ProductLayout({ children, params }: Props) {
  const { workspaceId, productId } = use(params);

  const base = `/workspaces/${workspaceId}/products/${productId}`;
  const nav = [
    { label: "Overview", href: base },
    { label: "Bets", href: `${base}/bets` },
    { label: "Metrics", href: `${base}/metrics` },
    { label: "Decision Log", href: `${base}/decision-logs` },
    { label: "Context Pack", href: `${base}/context-pack` },
    { label: "GitHub", href: `${base}/github` },
    { label: "Settings", href: `${base}/settings` },
  ];

  return <AppShell nav={nav}>{children}</AppShell>;
}
