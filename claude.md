# CLAUDE.md — SynaPilot OS Development Guide

**Version**: 1.0.0  
**Last Updated**: February 9, 2026  
**Purpose**: High-Signal Context for Claude Code (Agentic Development)

---

## 🎯 Project Mission

SynaPilot OS is a **High-Ticket PropTech SaaS** for French real estate agencies. Our goal: transform a standard CRM into a **Growth Engine** that automates compliance, qualifies leads with AI, and delivers predictive market insights.

**Target Market**: Post-crisis French agencies (1200+ bankruptcies in 2024). They need tools that guarantee legal safety and reduce time waste.

---

## 🏗️ Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | React 18 + TypeScript + Vite | |
| **UI** | Shadcn/UI + Tailwind CSS | Strict design system |
| **Backend** | Supabase (PostgreSQL + RLS) | Multi-tenancy via `organization_id` |
| **Auth** | Supabase Auth | Role-based (admin/manager/agent/viewer) |
| **AI** | OpenAI API (planned) | Lead qualification, OCR, content generation |

---

## 📂 Repo Architecture

src/
├── components/
│ ├── ui/ → Shadcn base components (Button, Card, etc.)
│ ├── properties/ → Property-specific components
│ └── ...
├── pages/ → Main views (Dashboard, Contacts, Properties, etc.)
├── integrations/
│ └── supabase/
│ ├── client.ts → Supabase instance
│ └── types.ts → Auto-generated DB types (SOURCE OF TRUTH)
├── hooks/ → Custom React hooks
├── contexts/ → React contexts (Auth, Org, etc.)
└── lib/ → Utilities

supabase/
└── migrations/ → SQL schema (if present)

text

---

## 🔑 Critical Data Models (Supabase)

### `properties` Table
**Purpose**: Core asset of the SaaS (real estate listings).

**Key Fields**:
- `dpe_label` (string): Energy rating (A-G). **Legal critical** in 2026.
- `energy_rating` (string): Consumption in kWh.
- `ges_label` (string): Greenhouse gas rating.
- `cadastral_ref` (string): Official land registry reference.
- `co_ownership_charges` (number): Monthly condo fees.
- `mandate_number` (string): Exclusive mandate ID.
- `status` (enum): `disponible | sous_compromis | vendu | loue | retire`

### `contacts` Table
**Key Fields**:
- `pipeline_stage` (enum): Current sales funnel position.
- `urgency_score` (number): AI-calculated priority (0-100).
- `role` (enum): `vendeur | acheteur | locataire | proprietaire | ...`

### `deals` Table
**Purpose**: Track sales transactions.
- Linked to `contact_id` and `property_id`.

---

## ⚙️ Development Rules

### 1. **Type Safety First**
- Always import types from `src/integrations/supabase/types.ts`.
- Use `Database['public']['Tables']['<table_name>']['Row']` for props.
- No `any` types allowed.

### 2. **UI Conventions**
- Use **Shadcn/UI** components exclusively (Card, Badge, Alert, Button, Dialog).
- Icons: `lucide-react` only.
- **Localization**: All user-facing text must be in **French**.

### 3. **Real Estate Domain**
- Use proper industry terms:
  - DPE (Diagnostic de Performance Énergétique)
  - Loi Carrez (surface measurement standard)
  - SRU (Solidarité et Renouvellement Urbain)
  - Syndic (HOA/Condo manager)

### 4. **Security & Multi-Tenancy**
- Every query must filter by `organization_id`.
- Respect Supabase RLS (Row-Level Security) policies.

---

## 🚀 Current Development Phase

**Phase 1: Compliance Automation** (IN PROGRESS)
- **Goal**: Reduce 30% time lost on DPE verification.
- **Status**: Building `PropertyComplianceAudit` component.
- **Next Steps**:
  1. Visual DPE display ✅ (Current task)
  2. PDF upload + OCR integration (Planned)
  3. Auto-validation workflow (Planned)

---

## 📋 Prompt Engineering Guidelines

When asking Claude Code for help:

### ✅ DO:
- Reference exact file paths (`src/components/properties/...`)
- Specify exact Supabase table/columns to use
- Provide example data structures
- Request TypeScript-first solutions

### ❌ DON'T:
- Ask to "explore the codebase" (wastes tokens)
- Request multiple features in one prompt
- Use vague terms like "make it better"
- Forget to specify French localization

---

## 🛠️ Common Commands

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Build
npm run build

Tech Debt Policy: Fix breaking changes immediately. Refactor during quiet sprints.

🎯 Success Metrics
A feature is "done" when:

✅ TypeScript compiles with zero errors

✅ UI text is in French

✅ Uses Shadcn components (no custom CSS hacks)

✅ Respects multi-tenancy (filters by organization_id)

✅ Works on mobile (responsive Tailwind)