<div align="center">

<img src="assets/logo-banner.svg" alt="PROZEN — Agentic PM OS" width="480" />

<br/>

[![License: MIT](https://img.shields.io/badge/License-MIT-1738BD.svg?style=flat-square)](LICENSE)
[![PRD Version](https://img.shields.io/badge/PRD-v1.3-3B5BDB.svg?style=flat-square)](docs/requirements-spec.md)
[![Status](https://img.shields.io/badge/Status-Active%20Development-10B981.svg?style=flat-square)](#status)
[![Node](https://img.shields.io/badge/Node-%3E%3D20-F59E0B.svg?style=flat-square)](#local-setup)

<br/>

**Cursor is for engineers. PROZEN is for PMs.**

*Stop doing fake work. Start making bets.*

<br/>

<a href="#english"><kbd>&nbsp;EN&nbsp;</kbd></a>
&nbsp;
<a href="#日本語"><kbd>&nbsp;日本語&nbsp;</kbd></a>

<br/>

[![Pitch Deck](https://img.shields.io/badge/Pitch%20Deck-View%20Slides-1738BD?style=for-the-badge&logo=googledrive&logoColor=white)](https://example.com/prozen-pitch-deck)
&nbsp;
[![Demo Video](https://img.shields.io/badge/Demo%20Video-Watch%20Now-EF4444?style=for-the-badge&logo=youtube&logoColor=white)](https://example.com/prozen-demo)

</div>

---

<a name="english"></a>

## Writing a PRD is not product work.

It is the *performance* of product work.

Confluence, Jira, Notion, Linear — these tools were built to make that performance legible to organizations. Stakeholder alignment. Status reports. Sprint reviews. Roadmap decks. None of it moves the product closer to PMF. None of it generates revenue.

**Real product work is exactly three things:**

| What matters | What it looks like |
|---|---|
| **Talk to customers** | Uncover what they actually need, not what they say they need |
| **Make bets** | Decide what to build — and what to permanently skip |
| **Read signals** | Learn from outcomes fast enough to course-correct before you run out of runway |

Everything else is fake work.

And in 2026, AI can do all of it.

---

## Built for AI-Native Teams

PROZEN is not a tool that adds AI features. It is built on the premise that AI has already changed what human work means.

In an AI-native organization:

- Specs are **generated**, not written
- Docs are **maintained by agents**, not humans
- Status reports are **synthesized**, not assembled
- Code is **reviewed by agents** before it reaches engineers

What remains irreducibly human: **judgment.**

Deciding which customer pain is worth betting on. Deciding when the data is telling you to pivot. Deciding what "done" actually looks like. These decisions cannot be delegated — but every other task around them can.

PROZEN is the environment built for that judgment work.

> Cursor removed the burden of writing code from engineers. What remained: architecture, design, taste.
> PROZEN removes the burden of writing specs from PMs. What remains: decisions, bets, learning.

---

## What PROZEN Does

> Within 5 minutes of first launch, you have a working Bet Spec for your own product — grounded in your actual metrics, with an AI that has already surfaced the risks you hadn't considered.

PROZEN is one continuous loop — not a document, not a dashboard, not a backlog:

```
Context  →  Bet  →  Signal  →  Learning  →  Next Bet
```

No switching between Notion, Jira, Mixpanel, and Slack. One environment. One decision loop. A compounding record of what you tried, what you learned, and what you're betting on next.

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

Not a document generator. A reasoning accelerator. You describe intent; the AI surfaces constraints, edge cases, and acceptance criteria you'd otherwise discover too late.

- Conversation-as-Spec workflow
- Acceptance-first: define "done" before "how"
- Living Spec: syncs with GitHub commits/PRs

</td>
<td width="33%" valign="top">

### C · Signal Loop
*The decision engine*

Dashboards that speak to your hypotheses. A three-layer metric model connects daily activity signals to KPIs to active Bets — and tells you what it means.

- Activity anomalies → KPI impact alerts
- Daily/weekly AI briefings
- Bet accuracy retrospectives

</td>
</tr>
</table>

---

## The Bet Structure

Every product decision in PROZEN follows one format. Not tasks. Not tickets. Not documents.

```
Hypothesis:  "Shortening onboarding will improve 7-day retention"
Bet:         2 weeks · targeting +5% KPI improvement
Outcome:     +2.3% — the driver was Y, not X
Learning:    Informs the next bet automatically
```

This is the atom of all product work. Every conversation with the Spec Agent, every signal alert, every morning briefing — it all connects back to active Bets.

### 3-Layer Metric Model

| Layer | What It Tracks | Cadence |
|---|---|---|
| **Bet** | Hypothesis-level KPI targets | Sprint → Quarter |
| **KPI** | Product health (MRR, churn, NPS) | Weekly / Monthly |
| **Activity** | User behavior signals (DAU, funnel, errors) | Daily / Real-time |

Layer 3 anomalies automatically trigger Layer 2 impact estimation, which triggers Layer 1 hypothesis reconciliation. No analyst required.

---

## AI Autonomous Actions

PROZEN's agent operates continuously — not just when you open the app.

| Trigger | Action |
|---|---|
| Every morning | Previous day summary + today's bet focus |
| Every evening | Decision log review + open questions for tomorrow |
| Weekly | Auto-generated bet accuracy retrospective |
| Pre-release | Bet Spec completeness checklist |
| Post-release | Metric change → hypothesis diff notification |
| Activity anomaly | Layer 3 spike/drop → Layer 1 impact alert |
| GitHub commit/PR | Diff detection → Living Spec update proposal |

---

## Why Now

| Signal | Implication |
|---|---|
| LLM inference cost is dropping 10x/year | Always-on PM agents are economically viable today |
| Cursor proved AI-native dev tools at scale | The same shift is coming for product — and it's faster |
| Solo founders scaling without PMs | The ICP exists, is underserved, and will pay |
| PRD tooling hasn't changed in 10 years | Greenfield. No incumbent with real switching costs |
| AI-native orgs are the new default | Tools built for document-first orgs are already legacy |

---

## Product Positioning

| | |
|---|---|
| **Category** | AI-native Product Management Operating System |
| **Core analogy** | Cursor is for engineers. PROZEN is for PMs. |
| **Target user** | Non-engineer solopreneur — owner, PM, decision maker |
| **Price (Solo Tier)** | `$99/month` |
| **Key differentiator** | Replaces fake work with real decisions. AI-native from day one. |
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

**Active development** — PRD v1.3 · March 2026 · Select, Inc.

---

<div align="center">

<img src="assets/logo.svg" width="32" height="32" alt="PROZEN" />

*The goal is not shipping features. The goal is PMF.*

</div>

---

<a name="日本語"></a>

<div align="center">

<img src="assets/logo-banner.svg" alt="PROZEN — Agentic PM OS" width="480" />

<br/>

<a href="#english"><kbd>&nbsp;EN&nbsp;</kbd></a>
&nbsp;
<a href="#日本語"><kbd>&nbsp;日本語&nbsp;</kbd></a>

<br/>

[![ピッチデック](https://img.shields.io/badge/ピッチデック-スライドを見る-1738BD?style=for-the-badge&logo=googledrive&logoColor=white)](https://example.com/prozen-pitch-deck)
&nbsp;
[![デモ動画](https://img.shields.io/badge/デモ動画-今すぐ見る-EF4444?style=for-the-badge&logo=youtube&logoColor=white)](https://example.com/prozen-demo)

</div>

---

## PRDを書くことは、プロダクト仕事ではない。

それは、プロダクト仕事の*パフォーマンス*だ。

Confluence、Jira、Notion、Linear——これらのツールは、そのパフォーマンスを組織に見せるために作られた。ステークホルダーへの報告。ステータス更新。スプリントレビュー。ロードマップの資料。そのどれも、PMFに1mmも近づかない。売上も生まない。

**プロダクト仕事として本当に意味があることは、たった3つだ：**

| 本物の仕事 | 具体的な行動 |
|---|---|
| **顧客と話す** | 彼らが「言うこと」ではなく「本当に必要なもの」を掘り出す |
| **ベットを決める** | 何を作るか——そして何を永遠に作らないかを決断する |
| **シグナルを読む** | 資金が尽きる前に結果から学び、軌道を修正する |

それ以外はすべて、**偽の仕事**だ。

そして2026年、AIがその偽の仕事をすべて引き受けられる。

---

## AIネイティブな組織のために作られている

PROZENは、AIの機能を追加したツールではない。**AIがすでに「人間の仕事」の意味を変えた**という前提の上に設計されている。

AIネイティブな組織では：

- 仕様書は**生成される**——書かれるのではなく
- ドキュメントは**エージェントが管理する**——人間ではなく
- ステータスレポートは**自動で合成される**——手で集めるのではなく
- コードは**エージェントがレビューする**——エンジニアに届く前に

それでも人間にしか委ねられないものが残る：**判断**。

どの顧客の痛みに賭けるか。データがピボットを示しているときに踏み切れるか。「完了」が本当は何を意味するのか。これらの意思決定は委任できない——しかしその周辺のすべては委任できる。

PROZENは、その判断のための環境だ。

> Cursorはエンジニアからコードを書く負担を取り除いた。残ったのは：アーキテクチャ、設計、センス。
> PROZENはPMから仕様を書く負担を取り除く。残るのは：意思決定、ベット、学習。

---

## PROZENとは

> ローンチから5分以内に、自分のプロダクトに合ったBet Spec（仮説仕様書）の初稿が手元にある。AIがすでに、見落としていたリスクを洗い出した状態で。

PROZENは、ひとつの継続するループだ——ドキュメントでも、ダッシュボードでも、バックログでもなく：

```
コンテキスト  →  ベット  →  シグナル  →  学習  →  次のベット
```

Notion・Jira・Mixpanel・Slackを行き来する必要はない。ひとつの環境。ひとつの意思決定ループ。試したこと、学んだこと、次に賭けることが、複利で蓄積されていく記録。

---

## コアアーキテクチャ

<table>
<tr>
<td width="33%" valign="top">

### A · コンテキスト層
*プロダクトの長期記憶*

AIが構造化するプロダクト知識ベース。エンジニアにとっての `@codebase` に相当するもの——すべてのBet・シグナル・提案に常に参照される。

- 自然言語 → 構造化コンテキスト
- フルバージョン管理・時点復元
- コンテキスト圧縮でAI推論コストを最適化

</td>
<td width="33%" valign="top">

### B · Specエージェント
*思考のパートナー*

ドキュメント生成ツールではない。推論加速装置だ。意図を伝えると、AIが見落としていた制約・エッジケース・受け入れ条件を、手遅れになる前に引き出す。

- 会話がそのままSpec成果物になる
- 完了定義ファースト：「どう作るか」より先に「完了とは何か」を決める
- Living Spec：GitHub commit/PRと同期

</td>
<td width="33%" valign="top">

### C · シグナルループ
*意思決定エンジン*

仮説に語りかけるダッシュボード。3層メトリクスモデルが、日々のアクティビティシグナルをKPIとアクティブなBetに自動で接続し、それが何を意味するかを教える。

- アクティビティ異常 → KPI影響アラート
- 毎朝・毎週のAIブリーフィング
- Bet精度の自動振り返りレポート

</td>
</tr>
</table>

---

## ベット構造

PROZENにおけるすべてのプロダクト意思決定は、ひとつのフォーマットに従う。タスクでも、チケットでも、ドキュメントでもない。

```
仮説:    「オンボーディングを短縮すると7日間リテンションが向上する」
ベット:  2週間の投資 · KPI +5%改善を目標
結果:    +2.3% — 主因はXではなくYだった
学習:    次のベットに自動的に反映される
```

これがすべてのプロダクト活動の基本単位だ。Specエージェントとの会話も、シグナルアラートも、朝のブリーフィングも——すべてがアクティブなBetにつながっている。

### 3層メトリクスモデル

| 層 | 計測対象 | サイクル |
|---|---|---|
| **Bet層** | 仮説ごとのKPI目標 | スプリント〜クォーター |
| **KPI層** | プロダクト健全性（MRR・チャーン・NPS） | 週次 / 月次 |
| **アクティビティ層** | ユーザー行動（DAU・ファネル・エラー率） | 日次 / リアルタイム |

第3層の異常が第2層のKPI影響推定を自動トリガーし、第1層の仮説照合へと連鎖する。アナリスト不要。

---

## AIの自律的アクション

PROZENのエージェントはアプリを開いていないときも、継続的に動作する。

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
| LLM推論コストが年10倍ペースで低下中 | 常時稼働のPMエージェントが、今日すでに経済的に成立する |
| CursorがAIネイティブ開発ツールを証明した | 同じシフトがプロダクト領域でも起きる——そしてより速く |
| エンジニアリング不在で拡張するソロ創業者 | ICPは存在し、放置されていて、対価を払う意志がある |
| PRDツールが10年間変わっていない | グリーンフィールド。スイッチングコストのある既存プレイヤーがいない |
| AIネイティブな組織が新しいデフォルトになった | ドキュメントファーストのツールはすでにレガシーだ |

---

## プロダクトポジショニング

| | |
|---|---|
| **カテゴリ** | AIネイティブ プロダクトマネジメント OS |
| **コア比較** | Cursorはエンジニアのもの。PROZENはPMのもの。 |
| **ターゲットユーザー** | 非エンジニアのソロ創業者——オーナー・PM・意思決定者 |
| **価格（Soloプラン）** | `$99/月` |
| **差別化要因** | 偽の仕事を本物の意思決定に置き換える。AIネイティブ設計。 |
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

**開発中** — PRD v1.3 · 2026年3月 · 株式会社Select

---

<div align="center">

<img src="assets/logo.svg" width="32" height="32" alt="PROZEN" />

*目標は機能を出荷することではない。PMFだ。*

<br/>

<a href="#english"><kbd>&nbsp; ページ上部（English）へ &nbsp;</kbd></a>

</div>
