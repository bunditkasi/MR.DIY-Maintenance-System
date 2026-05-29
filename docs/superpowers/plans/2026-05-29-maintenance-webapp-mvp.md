# Maintenance Webapp MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local React Webapp MVP that imports Lark CSV exports, creates/updates Maintenance Cases, and shows document/validation status.

**Architecture:** Lark remains the ticket source. The Webapp stores Lark data as snapshots and keeps app work data separately so CSV updates never overwrite document progress. The first implementation uses browser local state with deterministic sample data and a tested sync engine, ready to replace with Supabase later.

**Tech Stack:** React + Vite + TypeScript + Vitest, native CSV parsing for MVP, CSS modules via plain CSS.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `src/domain/types.ts`

- [ ] Create Vite React app files manually.
- [ ] Install dependencies with `npm install`.
- [ ] Run `npm test` and expect no tests found until Task 2.

### Task 2: CSV Sync Core

**Files:**
- Create: `src/domain/csvImport.test.ts`
- Create: `src/domain/csvImport.ts`

- [ ] Write tests for parsing Lark CSV rows, creating new cases, updating snapshots, preserving document work data, and detecting conflicts.
- [ ] Run `npm test -- --run src/domain/csvImport.test.ts` and confirm failures because implementation is missing.
- [ ] Implement `parseCsv`, `syncLarkRows`, and helper functions.
- [ ] Re-run the targeted test and confirm pass.

### Task 3: App UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] Build an app shell with sidebar, toolbar, CSV upload control, import preview, case table, and right detail panel.
- [ ] Use sample cases so the UI is usable before a CSV is uploaded.
- [ ] Wire CSV upload to `parseCsv` and `syncLarkRows`.
- [ ] Show counts for new, updated, unchanged, conflicts, and invalid rows.

### Task 4: Verification

**Files:**
- No new files expected.

- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
- [ ] Start `npm run dev -- --host 127.0.0.1`.
- [ ] Open the app in Browser/IAB and verify CSV import, table selection, and document checklist state.
