"use client";

import { use } from "react";
import { AppShell } from "@/components/layout/app-shell";

interface Props {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string; productId: string }>;
}

export default function ProductLayout({ children, params }: Props) {
  const { workspaceId, productId } = use(params);

  const nav = [
    { label: "Context Pack", href: `/workspaces/${workspaceId}/products/${productId}/context-pack` },
    { label: "Bets", href: `/workspaces/${workspaceId}/products/${productId}/bets` },
    { label: "Metrics", href: `/workspaces/${workspaceId}/products/${productId}/metrics` },
    { label: "Decision Log", href: `/workspaces/${workspaceId}/products/${productId}/decision-logs` },
    { label: "GitHub", href: `/workspaces/${workspaceId}/products/${productId}/github` },
    { label: "Settings", href: `/workspaces/${workspaceId}/products/${productId}/settings` },
  ];

  return <AppShell nav={nav}>{children}</AppShell>;
}
