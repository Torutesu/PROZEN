<div align="center">

<img src="assets/logo-banner.svg" alt="PROZEN — Agentic PM OS" width="480" />

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-1738BD.svg?style=flat-square)](LICENSE)
[![PRD Version](https://img.shields.io/badge/PRD-v1.3-3B5BDB.svg?style=flat-square)](docs/requirements-spec.md)
[![Status](https://img.shields.io/badge/Status-Active%20Development-10B981.svg?style=flat-square)](#status)
[![Powered by Claude](https://img.shields.io/badge/Powered%20by-Claude%20Sonnet-EF4444.svg?style=flat-square)](https://anthropic.com)
[![Node](https://img.shields.io/badge/Node-%3E%3D20-F59E0B.svg?style=flat-square)](#local-setup)

<br/>

**Cursor is for engineers. PROZEN is for PMs.**

*The environment where product managers stop writing documents and start making bets.*

<br/>

<a href="#english"><kbd>&nbsp;EN&nbsp;</kbd></a>
&nbsp;
<a href="#日本語"><kbd>&nbsp;日本語&nbsp;</kbd></a>

</div>

---

<a name="english"></a>

## The Problem

Most product tools are built around **documents** — PRDs that go stale the moment they're written, Jira boards that measure completions instead of outcomes, dashboards that show numbers but never connect them to your hypotheses.

The result: PMs spend 80% of their time writing, tracking, and reporting — and 20% actually thinking about what to build.

**PROZEN inverts that ratio.**

---

## What PROZEN Does

> Within 5 minutes of first launch, you have a working Bet Spec for your own product — grounded in your actual metrics, with AI that surfaces risks you hadn't considered.

PROZEN is a single, integrated loop:

```
Context  →  Bet  →  Signal  →  Learning  →  Next Bet
```

No switching between Notion, Jira, Mixpanel, and Slack. One environment. One decision loop. Continuously improving.

---

## Core Architecture

<table>
<tr>
<td width="33%" valign="top">

### A · Context Layer
*The product memory*

AI-structured product knowledge base. The equivalent of `@codebase` for product decisions — always available to every Bet, every signal, every recommendation.

- Natural language → structured context
- Full versioning with point-in-time restore
- Context compression for cost efficiency

</td>
<td width="33%" valign="top">

### B · Spec Agent
*The thinking partner*

Not a document generator. A reasoning accelerator. You describe intent; the AI surfaces constraints, edge cases, and acceptance criteria you'd otherwise miss.

- Conversation-as-Spec workflow
- Acceptance-first: define "done" before "how"
- Living Spec: syncs with GitHub commits/PRs

</td>
<td width="33%" valign="top">

### C · Signal Loop
*The decision engine*

Dashboards that speak to your hypotheses. Three-layer metric model connects daily activity signals to KPIs to active Bets — automatically.

- Activity anomalies → KPI impact alerts
- Daily/weekly AI briefings
- Bet accuracy retrospectives

</td>
</tr>
</table>

---

## The Bet Structure

Every product decision in PROZEN follows one format:

```
Hypothesis:  "Shortening onboarding will improve 7-day retention"
Bet:         2 weeks · targeting +5% KPI improvement
Outcome:     +2.3% — the driver was Y, not X
Learning:    Informs the next bet automatically
```

This structure — not tasks, not tickets, not documents — becomes the atom of all product work.

### 3-Layer Metric Model

| Layer | What It Tracks | Cadence |
|---|---|---|
| **Bet** | Hypothesis-level KPI targets | Sprint → Quarter |
| **KPI** | Product health (MRR, churn, NPS) | Weekly / Monthly |
| **Activity** | User behavior signals (DAU, funnel, errors) | Daily / Real-time |

Layer 3 anomalies automatically trigger Layer 2 impact estimation, which triggers Layer 1 hypothesis reconciliation.

---

## AI Autonomous Actions

PROZEN's agent operates continuously — not just when you open the app.

| Trigger | Action |
|---|---|
| Every morning | Previous day summary + today's bet focus |
| Every evening | Decision log review + open questions |
| Weekly | Auto-generated bet accuracy retrospective |
| Pre-release | Bet Spec completeness checklist |
| Post-release | Metric change → hypothesis diff notification |
| Activity anomaly | Layer 3 spike/drop → Layer 1 impact alert |
| GitHub commit/PR | Diff detection → Living Spec update proposal |

---

## Why Now

| Signal | Implication |
|---|---|
| LLM inference cost is dropping 10x/year | Always-on PM agents become economically viable |
| Cursor proved AI-native dev tools | The same shift is coming for product |
| Solo founders scaling without PMs | The ICP exists and is underserved |
| PRD tooling hasn't changed in 10 years | Greenfield opportunity |

---

## Product Positioning

| | |
|---|---|
| **Category** | AI-native Product Management Operating System |
| **Core analogy** | Cursor is for engineers. PROZEN is for PMs. |
| **Target user** | Non-engineer solopreneur — owner, PM, decision maker |
| **Price (Solo Tier)** | `$99/month` |
| **Key differentiator** | No engineering background required. AI-native from day one. |
| **Etymology** | Profit × Kaizen |

---

## Roadmap

| Phase | Scope | Gate |
|---|---|---|
| **Phase 1 — Web** | Core 3 modules for solo users · GitHub integration | — |
| **Phase 2 — Native** | iOS/Android · Offline · Claude Code integration | DAU + retention validated |
| **Phase 3 — Integrations** | Figma, Linear, Mixpanel · Export flows | Individual user base established |
| **Phase 4 — Enterprise** | Team PM features · SSO · Audit logs · SOC2 | Enterprise inbound demand |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| AI | Anthropic Claude Sonnet (claude-sonnet-4-6) |
| State | Zustand |
| Database | PostgreSQL 14+ |
| Runtime | Node.js ≥ 20 |
| Package Manager | pnpm |

---

## Design Principles

- **Application UI, not editor UI** — drives adoption with non-engineers
- **4px spacing grid** — precision without overhead
- **CSS Variables only** — consistent theming at scale
- **Mobile-first** — full functionality on iOS/Android browser

---

## Repository

| Document | Path |
|---|---|
| Requirements Specification | [`docs/requirements-spec.md`](docs/requirements-spec.md) |
| Development Plan | [`docs/development-plan.md`](docs/development-plan.md) |
| M0-M1 Technical Design | [`docs/technical-design-m0-m1.md`](docs/technical-design-m0-m1.md) |
| Bet Spec JSON Schema | [`schemas/bet-spec.schema.json`](schemas/bet-spec.schema.json) |
| Bet Spec TypeScript Model | [`src/domain/bet-spec.ts`](src/domain/bet-spec.ts) |

---

## Local Setup

### Prerequisites

- Node.js `>= 20`
- pnpm `>= 9`
- PostgreSQL `>= 14`

### Install

```bash
pnpm install
```

### Configure Environment

```bash
# Required
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/prozen

# Claude AI (required for spec generation and signal analysis)
export ANTHROPIC_API_KEY=your-anthropic-api-key

# Required for GitHub PAT encryption at rest (M4 Living Spec)
export GITHUB_TOKEN_ENCRYPTION_KEY=replace-with-32-byte-random-string

# API auth for /api/* endpoints (optional locally)
export PROZEN_API_KEY=your-local-api-key
```

### Migrate & Run

```bash
pnpm run migrate
pnpm run dev
```

API base: `http://127.0.0.1:8787`

Optional one-time backfill (encrypt legacy GitHub PAT rows at rest):

```bash
pnpm run backfill:github-tokens
```

### Run Web App (Next.js)

```bash
cd web
pnpm install
pnpm dev
```

Web base: `http://127.0.0.1:3000`

| Endpoint | Description |
|---|---|
| `GET /healthz` | Service health |
| `GET /schema/bet-spec` | Canonical Bet Spec schema |
| `POST /api/v1/workspaces/:id/products/:id/context-pack/ingest` | Ingest product context |
| `POST /api/v1/workspaces/:id/products/:id/decision-logs` | Record decision |

### Validate Schemas

```bash
pnpm run validate:bet-spec
pnpm run validate:context-pack
```

---

## Status

**Active development** — PRD v1.3 · March 2026 · Select KK

---

<div align="center">

<img src="assets/logo.svg" width="32" height="32" alt="PROZEN" />

*Built for the PM who bets on outcomes, not the one who ships features.*

</div>

---

<a name="日本語"></a>

<div align="center">

<img src="assets/logo-banner.svg" alt="PROZEN — Agentic PM OS" width="480" />

<br/>

<a href="#english"><kbd>&nbsp;EN&nbsp;</kbd></a>
&nbsp;
<a href="#日本語"><kbd>&nbsp;日本語&nbsp;</kbd></a>

</div>

---

## 課題

多くのプロダクトツールは**ドキュメント**を中心に設計されています。書いた瞬間に陳腐化するPRD、完了数を計測するだけのJira、仮説とつながらない数字を並べるだけのダッシュボード。

結果として、PMは時間の80%を「書くこと・管理すること・報告すること」に費やし、**本当に重要な「何を作るか」の判断**に使える時間は20%しか残りません。

**PROZENはその比率を逆転させます。**

---

## PROZENとは

> ローンチから5分以内に、自分のプロダクトに合ったBet Spec（仮説仕様書）の初稿が手元にある。AIが見落としていたリスクを洗い出した状態で。

PROZENは、1つの統合されたループです：

```
コンテキスト  →  ベット  →  シグナル  →  学習  →  次のベット
```

Notion・Jira・Mixpanel・Slackを行き来する必要はありません。ひとつの環境。ひとつの意思決定ループ。継続的に改善されます。

---

## コアアーキテクチャ

<table>
<tr>
<td width="33%" valign="top">

### A · コンテキスト層
*プロダクトの長期記憶*

AIが構造化するプロダクト知識ベース。エンジニアにとっての `@codebase` に相当するもの——すべてのBet・シグナル・提案に常に参照されます。

- 自然言語 → 構造化コンテキスト
- フルバージョン管理・時点復元
- コンテキスト圧縮でAI推論コストを最適化

</td>
<td width="33%" valign="top">

### B · Specエージェント
*思考のパートナー*

ドキュメント生成ツールではありません。推論加速装置です。意図を伝えると、AIが見落としていた制約・エッジケース・受け入れ条件を引き出します。

- 会話がそのままSpec成果物になる
- 完了定義ファースト：「どう作るか」より先に「完了とは何か」を決める
- Living Spec：GitHub commit/PRと同期

</td>
<td width="33%" valign="top">

### C · シグナルループ
*意思決定エンジン*

仮説と対話するダッシュボード。3層メトリクスモデルが、日々のアクティビティシグナルをKPIとアクティブなBetに自動的に接続します。

- アクティビティ異常 → KPI影響アラート
- 毎朝・毎週のAIブリーフィング
- Bet精度の自動振り返りレポート

</td>
</tr>
</table>

---

## ベット構造

PROZENにおけるすべてのプロダクト意思決定は、1つのフォーマットで表現されます：

```
仮説:    「オンボーディングを短縮すると7日間リテンションが向上する」
ベット:  2週間の投資 · KPI +5%改善を目標
結果:    +2.3% — 主因はXではなくYだった
学習:    次のベットに自動的に反映される
```

このフォーマット——タスクでも、チケットでも、ドキュメントでもなく——がすべてのプロダクト活動の基本単位になります。

### 3層メトリクスモデル

| 層 | 計測対象 | サイクル |
|---|---|---|
| **Bet層** | 仮説ごとのKPI目標 | スプリント〜クォーター |
| **KPI層** | プロダクト健全性（MRR・チャーン・NPS） | 週次 / 月次 |
| **アクティビティ層** | ユーザー行動（DAU・ファネル・エラー率） | 日次 / リアルタイム |

第3層の異常が第2層のKPI影響推定を自動トリガーし、第1層の仮説照合へと連鎖します。

---

## AIの自律的アクション

PROZENのエージェントはアプリを開いていないときも、継続的に動作します。

| トリガー | アクション |
|---|---|
| 毎朝 | 前日のサマリー + 今日のBetフォーカス |
| 毎晩 | 意思決定ログのレビュー + 翌日の未解決問題 |
| 毎週 | Bet精度の自動振り返りレポート生成 |
| リリース前 | Bet Spec完全性チェックリスト |
| リリース後 | メトリクス変化 → 仮説差分通知 |
| アクティビティ異常 | 第3層スパイク/ドロップ → 第1層インパクトアラート |
| GitHub commit/PR | 差分検出 → Living Spec更新提案 |

---

## なぜ今なのか

| シグナル | 意味 |
|---|---|
| LLM推論コストが年10倍ペースで低下中 | 常時稼働のPMエージェントが経済的に成立する |
| CursorがAIネイティブ開発ツールを証明した | 同じシフトがプロダクト領域でも起きる |
| エンジニアリング不在で拡張するソロ創業者 | ICPは存在し、今も放置されている |
| PRDツールが10年間変わっていない | グリーンフィールドの機会 |

---

## プロダクトポジショニング

| | |
|---|---|
| **カテゴリ** | AIネイティブ プロダクトマネジメント OS |
| **コア比較** | Cursorはエンジニアのもノ。PROZENはPMのもの。 |
| **ターゲットユーザー** | 非エンジニアのソロ創業者——オーナー・PM・意思決定者 |
| **価格（Soloプラン）** | `$99/月` |
| **差別化要因** | エンジニアリング知識不要。AIネイティブ設計。オールインワン。 |
| **語源** | Profit（利益）× Kaizen（改善） |

---

## ロードマップ

| フェーズ | スコープ | 移行条件 |
|---|---|---|
| **Phase 1 — Web** | コア3モジュール（ソロ向け）· GitHub連携 | — |
| **Phase 2 — Native** | iOS/Android · オフライン · Claude Code連携 | DAU・リテンション検証済み |
| **Phase 3 — Integrations** | Figma・Linear・Mixpanel連携 · エクスポート | 個人ユーザー基盤確立 |
| **Phase 4 — Enterprise** | チームPM機能 · SSO · 監査ログ · SOC2 | エンタープライズからのインバウンド需要 |

---

## ステータス

**開発中** — PRD v1.3 · 2026年3月 · 合同会社Select

---

<div align="center">

<img src="assets/logo.svg" width="32" height="32" alt="PROZEN" />

*機能を出荷するPMではなく、成果に賭けるPMのために。*

<br/>

<a href="#english"><kbd>&nbsp; ページ上部（English）へ &nbsp;</kbd></a>

</div>
