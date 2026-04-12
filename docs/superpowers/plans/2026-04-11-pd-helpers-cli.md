# Plan A — `pd-helpers` CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a new standalone TypeScript CLI repo `~/git/pd-helpers` that seeds NordLight Solar demo leads into one or both Pipedrive accounts (pipeagent + digital-pd-team), with email-based collision detection, plus wipe and prewarm helpers for TEX demo preparation.

**Architecture:** Pure Node 20+ with built-in `fetch`, ESM, no runtime framework dependencies. CLI entrypoints are thin shims over testable core modules with dependency injection for the Pipedrive client factory. Tests use Vitest with mocked `fetch` — no live Pipedrive calls in CI. The 20-item lead pool is copy-lifted from `pipeagent/apps/server/src/seed/companies.ts` with stable `slug` fields added.

**Tech Stack:** TypeScript 5.6+, Node 20+ (built-in `fetch`), Vitest 2.x, pnpm, ESM (`"type": "module"`). Zero runtime dependencies beyond what Node provides.

**Corresponding spec:** `docs/superpowers/specs/2026-04-11-pd-helpers-and-agent-hub-redesign-design.md` (this plan covers Phase 1 + the `pd-wipe` and `prewarm` pieces of Phase 3).

---

## File Structure

All paths are relative to `~/git/pd-helpers/` (the new sibling repo to `~/git/pipeagent/` and `~/git/digital-pd-team/`).

### Files to create

```
~/git/pd-helpers/
├── .env.example                  # Example env vars for both PD accounts
├── .gitignore                    # .env, node_modules, dist, coverage
├── README.md                     # Usage docs
├── package.json                  # ESM, pnpm, bin entries for pd-seed/pd-wipe/prewarm
├── pnpm-workspace.yaml           # (minimal — declares this single package)
├── tsconfig.json                 # Strict, NodeNext, ES2022 target
├── vitest.config.ts              # Node environment, coverage config
├── src/
│   ├── types.ts                  # SeedLead, TargetName, TargetConfig, PDResponses
│   ├── pool.ts                   # The 20 seed leads with slug + data
│   ├── args.ts                   # Parse CLI argv → typed options object
│   ├── targets.ts                # Load env vars → TargetConfig map
│   ├── pd-client.ts              # Pipedrive v1 REST wrapper (fetch-based)
│   ├── dedupe.ts                 # Email-based in-use check
│   ├── seed-core.ts              # Pure seed orchestration (testable)
│   ├── seed.ts                   # pd-seed CLI entrypoint
│   ├── wipe-core.ts              # Pure wipe orchestration (testable)
│   ├── wipe.ts                   # pd-wipe CLI entrypoint
│   ├── prewarm-core.ts           # Pure prewarm orchestration (testable)
│   ├── prewarm.ts                # prewarm CLI entrypoint
│   └── util.ts                   # Shared helpers (random pick, exit codes)
└── tests/
    ├── pool.test.ts              # 20 items, unique slugs, valid emails
    ├── args.test.ts              # Parse flag combos, error cases
    ├── targets.test.ts           # Env var loading, missing-token errors
    ├── pd-client.test.ts         # Mocked fetch, each method
    ├── dedupe.test.ts            # In-use vs available decisions
    ├── seed-core.test.ts         # Full seed orchestration with mock client
    ├── wipe-core.test.ts         # Wipe orchestration with mock client
    └── prewarm-core.test.ts      # Prewarm orchestration with mock HTTP
```

### Files to modify in sibling repos

Modified **only after Plan A is merged and `pd-helpers` works:**

- `pipeagent/apps/server/src/seed/` — entire directory deleted (cli.ts, generator.ts, companies.ts). Deferred to Plan B.
- `pipeagent/apps/server/src/routes/seed.ts` — deleted. Deferred to Plan B.
- `pipeagent/apps/server/src/server.ts` — unmount `/seed` route. Deferred to Plan B.
- `pipeagent/apps/web/src/agents/lead-qualification/components/LeadsList.tsx` — remove "+ Generate Leads" button. Deferred to Plan B.

**This plan does not touch pipeagent.** The lifted pool data is a copy, not a move. Plan B removes the originals.

---

## Tech Stack Notes

**Why Vitest and not the node built-in test runner?** Vitest has ergonomic mocking (`vi.fn()`, `vi.spyOn()`), snapshot testing, and zero-config TypeScript + ESM support. The built-in runner requires a separate compile step for TS and has awkward mock ergonomics. Vitest is the modern default and what the target audience (future us, future engineers) will expect.

**Why no CLI parsing library?** `commander`, `yargs`, `meow` are all overkill for 4 flags. Bare `process.argv` parsing in `args.ts` is ~40 lines and testable.

**Why no HTTP library?** Node 20+ has `fetch` built-in. Mocking `global.fetch` in tests is trivial with Vitest.

**Why dependency injection for the PD client?** So `seed-core.ts`, `wipe-core.ts`, and `prewarm-core.ts` can be tested against a fake client without any HTTP at all. The CLI shims (`seed.ts`, etc.) wire up the real client; everything else takes the client as a parameter.

---

## Assumptions

- **Node version:** Node 20.x or newer (for built-in `fetch`). The shebang lines and README state this explicitly.
- **Package manager:** pnpm 9+. The user has pnpm installed already (pipeagent uses it).
- **Pipedrive accounts:** Two distinct Pipedrive companies, each with an API token generated from Settings → Personal → API. The API domain is the same for both (`https://api-proxy.pipedrive.com`) but tokens differ.
- **Lead pool:** The 20-item pool from `pipeagent/apps/server/src/seed/companies.ts` is the source of truth. Plan A lifts it verbatim.
- **No CI:** This repo won't have CI pipelines. Tests are run manually via `pnpm test`.
- **Working directory when running tasks:** Unless explicitly stated, each task assumes `cd ~/git/pd-helpers`.

---

## Task 1: Initialize the repo

**Files:**
- Create: `~/git/pd-helpers/package.json`
- Create: `~/git/pd-helpers/tsconfig.json`
- Create: `~/git/pd-helpers/.gitignore`
- Create: `~/git/pd-helpers/.env.example`
- Create: `~/git/pd-helpers/vitest.config.ts`

- [ ] **Step 1: Create the repo directory and init git**

```bash
mkdir -p ~/git/pd-helpers
cd ~/git/pd-helpers
git init
git branch -m main
```

Expected: creates `.git/` in the new directory.

- [ ] **Step 2: Write `package.json`**

Create `~/git/pd-helpers/package.json`:

```json
{
  "name": "pd-helpers",
  "version": "0.1.0",
  "description": "Shared Pipedrive helpers and demo seeder for pipeagent and digital-pd-team",
  "type": "module",
  "bin": {
    "pd-seed": "./dist/seed.js",
    "pd-wipe": "./dist/wipe.js",
    "pd-prewarm": "./dist/prewarm.js"
  },
  "scripts": {
    "build": "tsc",
    "dev:seed": "tsx src/seed.ts",
    "dev:wipe": "tsx src/wipe.ts",
    "dev:prewarm": "tsx src/prewarm.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 3: Write `tsconfig.json`**

Create `~/git/pd-helpers/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Write `.gitignore`**

Create `~/git/pd-helpers/.gitignore`:

```
node_modules/
dist/
coverage/
.env
.DS_Store
*.log
```

- [ ] **Step 5: Write `.env.example`**

Create `~/git/pd-helpers/.env.example`:

```
# Pipedrive API credentials for the pipeagent account
PD_PIPEAGENT_API_TOKEN=your_pipeagent_token_here
PD_PIPEAGENT_API_DOMAIN=https://api-proxy.pipedrive.com

# Pipedrive API credentials for the digital-pd-team account
PD_DIGITAL_API_TOKEN=your_digital_token_here
PD_DIGITAL_API_DOMAIN=https://api-proxy.pipedrive.com

# Optional: pipeagent webhook URL for the prewarm script
PIPEAGENT_WEBHOOK_URL=https://pipeagent.xtian.me/webhooks/pipedrive
```

- [ ] **Step 6: Write `vitest.config.ts`**

Create `~/git/pd-helpers/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/seed.ts', 'src/wipe.ts', 'src/prewarm.ts'],
    },
  },
});
```

Note: the CLI shim files (`seed.ts`, `wipe.ts`, `prewarm.ts`) are excluded from coverage because they're tested indirectly via `*-core.test.ts`.

- [ ] **Step 7: Install dependencies**

```bash
cd ~/git/pd-helpers
pnpm install
```

Expected: creates `node_modules/` and `pnpm-lock.yaml`. Exit code 0.

- [ ] **Step 8: Verify typecheck passes on empty src**

```bash
mkdir -p src tests
echo 'export {};' > src/index.ts
pnpm typecheck
```

Expected: `tsc --noEmit` exits 0 (nothing to check but no errors).

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json .gitignore .env.example vitest.config.ts pnpm-lock.yaml src/index.ts
git commit -m "chore: init pd-helpers repo with TypeScript + Vitest"
```

---

## Task 2: Define shared types

**Files:**
- Create: `~/git/pd-helpers/src/types.ts`

- [ ] **Step 1: Write the types**

Replace `~/git/pd-helpers/src/index.ts` with `~/git/pd-helpers/src/types.ts`:

```ts
// Pool item shape — one entry in pool.ts
export type SeedLead = {
  slug: string;              // stable ID, e.g. "mari-tamm-pirita"
  company: string;
  type: 'B2B' | 'Residential';
  location: string;
  industry: string;
  employees: number | null;
  contactName: string;
  email: string;
  phone: string;
  source: string;
  notes: string;
};

// Which Pipedrive account a command targets
export type TargetName = 'pipeagent' | 'digital-pd-team';

// Resolved credentials for one account
export type TargetConfig = {
  name: TargetName;
  token: string;
  domain: string;
};

// Pipedrive API response shapes — narrow to fields we actually use
export type PDPerson = {
  id: number;
  name: string;
  email?: Array<{ value: string; primary: boolean }>;
};

export type PDOrganization = {
  id: number;
  name: string;
};

export type PDLead = {
  id: string;
  title: string;
  person_id: number | null;
  organization_id: number | null;
  is_archived: boolean;
};

export type PDDeal = {
  id: number;
  title: string;
  status: 'open' | 'won' | 'lost' | 'deleted';
  person_id: number | null;
};

export type PDSearchResult<T> = {
  items: Array<{ item: T; result_score: number }>;
};

// Narrow type for "is this person currently blocking a pool item from reuse?"
export type InUseCheck = {
  inUse: boolean;
  reason: string | null;  // e.g. "open lead #324" or "open deal #87"
};

// Outcome of creating a lead in one account
export type CreateResult =
  | {
      target: TargetName;
      ok: true;
      personId: number;
      orgId: number;
      leadId: string;
      title: string;
    }
  | {
      target: TargetName;
      ok: false;
      error: string;
    };
```

- [ ] **Step 2: Delete the placeholder index file**

```bash
rm ~/git/pd-helpers/src/index.ts
```

- [ ] **Step 3: Verify typecheck**

```bash
cd ~/git/pd-helpers
pnpm typecheck
```

Expected: exits 0 (types compile cleanly).

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git rm -f src/index.ts
git commit -m "feat: define shared types for pool, targets, and PD responses"
```

---

## Task 3: Lead pool (TDD)

**Files:**
- Create: `~/git/pd-helpers/tests/pool.test.ts`
- Create: `~/git/pd-helpers/src/pool.ts`

The pool data is lifted from `pipeagent/apps/server/src/seed/companies.ts` with a new `slug` field per entry. **Read that file first** to get the 20 entries, then generate slugs as `kebab-case(contactName + '-' + locationWord)`.

- [ ] **Step 1: Write the failing test**

Create `~/git/pd-helpers/tests/pool.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { POOL } from '../src/pool.js';

describe('POOL', () => {
  it('contains exactly 20 items', () => {
    expect(POOL).toHaveLength(20);
  });

  it('has unique slugs', () => {
    const slugs = POOL.map((p) => p.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it('has unique emails', () => {
    const emails = POOL.map((p) => p.email.toLowerCase());
    const unique = new Set(emails);
    expect(unique.size).toBe(emails.length);
  });

  it('all slugs are kebab-case (lowercase, hyphen-separated)', () => {
    for (const item of POOL) {
      expect(item.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('all emails contain @', () => {
    for (const item of POOL) {
      expect(item.email).toContain('@');
    }
  });

  it('each item has every required field', () => {
    for (const item of POOL) {
      expect(item.slug).toBeTruthy();
      expect(item.company).toBeTruthy();
      expect(['B2B', 'Residential']).toContain(item.type);
      expect(item.location).toBeTruthy();
      expect(item.contactName).toBeTruthy();
      expect(item.email).toBeTruthy();
      expect(item.phone).toBeTruthy();
      expect(item.source).toBeTruthy();
    }
  });

  it('contains at least one B2B and one Residential lead', () => {
    const b2b = POOL.filter((p) => p.type === 'B2B');
    const res = POOL.filter((p) => p.type === 'Residential');
    expect(b2b.length).toBeGreaterThan(0);
    expect(res.length).toBeGreaterThan(0);
  });

  it('contains Andrus Koppel from Smarten Logistics (first entry in the pool)', () => {
    const andrus = POOL.find((p) => p.contactName === 'Andrus Koppel');
    expect(andrus).toBeDefined();
    expect(andrus?.company).toBe('Smarten Logistics AS');
    expect(andrus?.slug).toBe('andrus-koppel-tallinn');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/git/pd-helpers
pnpm test
```

Expected: FAIL with `Cannot find module '../src/pool.js'` or similar import error.

- [ ] **Step 3: Create `src/pool.ts`**

Create `~/git/pd-helpers/src/pool.ts` with all 20 entries lifted from `pipeagent/apps/server/src/seed/companies.ts`. Slugs are `kebab(contactName + '-' + firstLocationWord)`, de-accented (`ä` → `a`, `ö` → `o`, `õ` → `o`, `ü` → `u`):

```ts
import type { SeedLead } from './types.js';

// Lifted from pipeagent/apps/server/src/seed/companies.ts on 2026-04-11.
// Slugs derived from kebab(contactName + "-" + firstLocationWord), de-accented.
// When Plan B deletes pipeagent's copy, this file becomes the sole source of truth.
export const POOL: SeedLead[] = [
  {
    slug: 'andrus-koppel-tallinn',
    company: 'Smarten Logistics AS',
    type: 'B2B',
    location: 'Tallinn (Rae)',
    industry: 'Warehousing / Logistics',
    employees: 150,
    contactName: 'Andrus Koppel',
    email: 'andrus.koppel@smarten.ee',
    phone: '+372 5345 6789',
    source: 'Trade show (GreenTech Estonia)',
    notes: 'Largest Estonian-owned 3PL provider. Multiple large warehouse roofs. Looking into ESG reporting & energy cost reduction.',
  },
  {
    slug: 'igor-petrov-tallinn',
    company: 'Forwex Estonia OÜ',
    type: 'B2B',
    location: 'Tallinn (Pirita)',
    industry: 'Logistics / Freight Forwarding',
    employees: 20,
    contactName: 'Igor Petrov',
    email: 'igor.petrov@forwex.ee',
    phone: '+372 5123 4568',
    source: 'LinkedIn connection request',
    notes: 'Freight forwarding company — office-only operation, no warehouses owned. Rents 200m² office space in business park.',
  },
  {
    slug: 'margus-linna-parnu',
    company: 'Hedon Spa & Hotel',
    type: 'B2B',
    location: 'Pärnu',
    industry: 'Hospitality / Hotel',
    employees: 80,
    contactName: 'Margus Linna',
    email: 'margus.linna@hedonspa.com',
    phone: '+372 5123 4567',
    source: 'LinkedIn outbound',
    notes: 'Large spa hotel with flat rooftop. High energy costs from pool heating & spa operations. Interested in sustainability branding.',
  },
  {
    slug: 'aleksei-volkov-lasnamae',
    company: 'Aleksei Volkov',
    type: 'Residential',
    location: 'Lasnamäe, Tallinn',
    industry: 'Homeowner (apartment)',
    employees: null,
    contactName: 'Aleksei Volkov',
    email: 'aleksei.volkov@mail.ee',
    phone: '+372 5234 5679',
    source: 'Google Ads',
    notes: 'Lives in 9th floor apartment in Soviet-era panel building. Interested in solar but has no roof access or decision authority.',
  },
  {
    slug: 'piret-uus-laagri',
    company: 'Väike Päike (Laagri daycare)',
    type: 'B2B',
    location: 'Laagri, Harjumaa',
    industry: 'Education / Childcare',
    employees: 35,
    contactName: 'Piret Uus',
    email: 'piret.uus@lasteklubi.ee',
    phone: '+372 5456 7890',
    source: 'Referral from existing customer',
    notes: 'Private daycare chain with multiple locations. Laagri building has good south-facing roof. Interested in green marketing to parents.',
  },
  {
    slug: 'kadri-laas-tartu',
    company: 'Werner Cafe',
    type: 'B2B',
    location: 'Tartu',
    industry: 'Café / Restaurant',
    employees: 10,
    contactName: 'Kadri Laas',
    email: 'kadri@wernercafe.ee',
    phone: '+372 5345 6780',
    source: 'Walk-in at trade show',
    notes: 'Historic café on Tartu Town Hall Square. Operates in rented ground-floor space of a heritage-protected building.',
  },
  {
    slug: 'tonis-valk-kuressaare',
    company: 'Saaremaa Piimatööstus (MO Saaremaa)',
    type: 'B2B',
    location: 'Kuressaare, Saaremaa',
    industry: 'Food Manufacturing / Dairy',
    employees: 120,
    contactName: 'Tõnis Valk',
    email: 'tonis.valk@mosaaremaa.ee',
    phone: '+372 5567 8901',
    source: 'Cold email outreach',
    notes: 'Largest organic dairy producer in Estonia. Modern production facility with large roof. Already has sustainability certifications (FSSC 22000, ISO 45001).',
  },
  {
    slug: 'bolt-technology-tallinn',
    company: 'Bolt Technology OÜ',
    type: 'B2B',
    location: 'Tallinn',
    industry: 'Technology / Ride-hailing',
    employees: 4000,
    contactName: 'General inquiry',
    email: 'sustainability@bolt.eu',
    phone: '+372 6 123 456',
    source: 'Website form',
    notes: 'Major tech company inquiring about solar for their HQ. Enterprise-level procurement process, 12+ month decision cycle.',
  },
  {
    slug: 'jaan-tammsaar-nomme',
    company: 'Jaan & Maria Tammsaar',
    type: 'Residential',
    location: 'Nõmme, Tallinn',
    industry: 'Homeowner',
    employees: null,
    contactName: 'Jaan Tammsaar',
    email: 'jaan.tammsaar@gmail.com',
    phone: '+372 5678 9012',
    source: 'Google Ads',
    notes: 'Couple in their 40s, renovated 1930s wooden house. South-facing roof, no shading. Interested in reducing €180/month electricity bill.',
  },
  {
    slug: 'sarah-mitchell-tallinn',
    company: 'Tallinn International Kindergarten',
    type: 'B2B',
    location: 'Tallinn (Kesklinn)',
    industry: 'Education / Childcare',
    employees: 15,
    contactName: 'Sarah Mitchell',
    email: 'sarah.mitchell@kindergarten.ee',
    phone: '+372 5567 8902',
    source: 'Email inquiry',
    notes: 'Private kindergarten in rented residential building in central Tallinn. Building owned by separate property company.',
  },
  {
    slug: 'triin-kallas-tallinn',
    company: 'Kalamaja Pagarikoda',
    type: 'B2B',
    location: 'Tallinn (Kalamaja)',
    industry: 'Bakery / Food Service',
    employees: 12,
    contactName: 'Triin Kallas',
    email: 'triin@kalamajapagarikoda.ee',
    phone: '+372 5890 1234',
    source: 'Referral',
    notes: 'Artisan bakery with own building. Ovens run 14hrs/day — very high electricity costs. Owner is personally passionate about sustainability.',
  },
  {
    slug: 'martin-aas-tallinn',
    company: 'OÜ DigitalNomad Consulting',
    type: 'B2B',
    location: 'Tallinn (remote)',
    industry: 'IT Consulting',
    employees: 3,
    contactName: 'Martin Aas',
    email: 'martin@digitalnomad.ee',
    phone: '+372 5678 9013',
    source: 'LinkedIn',
    notes: '3-person IT consulting firm. Works remotely from co-working spaces. No physical office or property. Curious about solar for personal home.',
  },
  {
    slug: 'katlin-org-parnu',
    company: 'Villa Ammende',
    type: 'B2B',
    location: 'Pärnu',
    industry: 'Hospitality / Restaurant & Hotel',
    employees: 25,
    contactName: 'Kätlin Org',
    email: 'katlin@ammende.ee',
    phone: '+372 5234 5678',
    source: 'Website form',
    notes: 'Boutique luxury hotel in Art Nouveau villa. Looking to reduce operating costs and appeal to eco-conscious tourists.',
  },
  {
    slug: 'katrin-lepik-viimsi',
    company: 'Katrin & Siim Lepik',
    type: 'Residential',
    location: 'Viimsi, Harjumaa',
    industry: 'Homeowner',
    employees: null,
    contactName: 'Katrin Lepik',
    email: 'katrin.lepik@gmail.com',
    phone: '+372 5901 2346',
    source: 'Referral from neighbor',
    notes: 'Young family, just built new house in Viimsi. Roof is north-facing with heavy tree cover. Already spent full renovation budget.',
  },
  {
    slug: 'liina-mets-tartu',
    company: 'Tartu Hotel (Hotel Pärnu group)',
    type: 'B2B',
    location: 'Tartu',
    industry: 'Hospitality / Hotel',
    employees: 30,
    contactName: 'Liina Mets',
    email: 'liina.mets@tartuhotel.ee',
    phone: '+372 5789 0123',
    source: 'Website organic',
    notes: 'Mid-range city-center hotel. Looking at energy efficiency upgrades as part of planned renovation in 2027.',
  },
  {
    slug: 'peeter-koiv-narva',
    company: 'Peeter Kõiv',
    type: 'Residential',
    location: 'Narva',
    industry: 'Homeowner',
    employees: null,
    contactName: 'Peeter Kõiv',
    email: 'peeter.koiv@hot.ee',
    phone: '+372 5456 7891',
    source: 'Facebook ad',
    notes: "Homeowner in Narva (eastern Estonia). Owns detached house with good roof. Interested but NordLight doesn't operate in Ida-Virumaa.",
  },
  {
    slug: 'sander-kivimagi-tartu',
    company: 'Cruffin Bakehouse',
    type: 'B2B',
    location: 'Tartu',
    industry: 'Café / Bakery',
    employees: 6,
    contactName: 'Sander Kivimägi',
    email: 'sander@cruffin.ee',
    phone: '+372 5901 2345',
    source: 'Instagram DM',
    notes: "Trendy croissanterie in rented space in Tartu city center. Interested in 'going green' but doesn't own the property.",
  },
  {
    slug: 'raimo-jarv-tartu',
    company: 'Laki Logistics (Tartu terminal)',
    type: 'B2B',
    location: 'Tartu',
    industry: 'Logistics / Distribution',
    employees: 45,
    contactName: 'Raimo Järv',
    email: 'raimo.jarv@laki.ee',
    phone: '+372 5890 1235',
    source: 'Trade show',
    notes: 'Distribution terminal in Tartu. Large flat-roof warehouse. However, building is leased from Mainor Ülemiste — not owned.',
  },
  {
    slug: 'ulle-rand-kardla',
    company: 'Hiiumaa Köök ja Pagar OÜ',
    type: 'B2B',
    location: 'Kärdla, Hiiumaa',
    industry: 'Food Production',
    employees: 8,
    contactName: 'Ülle Rand',
    email: 'ulle@hiiumaapagarid.ee',
    phone: '+372 5012 3456',
    source: 'Cold email',
    notes: 'Small food producer on Hiiumaa island. Owns building. Interested in energy independence due to unreliable grid on island.',
  },
  {
    slug: 'maris-saar-kardla',
    company: 'Padu Hotell',
    type: 'B2B',
    location: 'Kärdla, Hiiumaa',
    industry: 'Hospitality / Guesthouse',
    employees: 4,
    contactName: 'Maris Saar',
    email: 'maris@paduhotell.ee',
    phone: '+372 5789 0124',
    source: 'Website form',
    notes: 'Small seasonal guesthouse on Hiiumaa. Open only June–August. Very small electricity usage. Owns property but tiny building.',
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test
```

Expected: all 8 test cases pass, 1 test file, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/pool.ts tests/pool.test.ts
git commit -m "feat: add 20-item seed pool lifted from pipeagent companies.ts"
```

---

## Task 4: CLI argument parser (TDD)

**Files:**
- Create: `~/git/pd-helpers/tests/args.test.ts`
- Create: `~/git/pd-helpers/src/args.ts`

- [ ] **Step 1: Write the failing test**

Create `~/git/pd-helpers/tests/args.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseSeedArgs, parseWipeArgs } from '../src/args.js';

describe('parseSeedArgs', () => {
  it('parses --target both', () => {
    const opts = parseSeedArgs(['--target', 'both']);
    expect(opts.targets).toEqual(['pipeagent', 'digital-pd-team']);
  });

  it('parses --target pipeagent', () => {
    const opts = parseSeedArgs(['--target', 'pipeagent']);
    expect(opts.targets).toEqual(['pipeagent']);
  });

  it('parses --target digital-pd-team', () => {
    const opts = parseSeedArgs(['--target', 'digital-pd-team']);
    expect(opts.targets).toEqual(['digital-pd-team']);
  });

  it('errors with no target', () => {
    expect(() => parseSeedArgs([])).toThrow(/--target is required/);
  });

  it('errors with invalid target', () => {
    expect(() => parseSeedArgs(['--target', 'nonsense'])).toThrow(/invalid target/);
  });

  it('parses --dry-run', () => {
    const opts = parseSeedArgs(['--target', 'both', '--dry-run']);
    expect(opts.dryRun).toBe(true);
  });

  it('dry-run defaults to false', () => {
    const opts = parseSeedArgs(['--target', 'pipeagent']);
    expect(opts.dryRun).toBe(false);
  });

  it('parses --list', () => {
    const opts = parseSeedArgs(['--target', 'both', '--list']);
    expect(opts.list).toBe(true);
  });

  it('parses --name', () => {
    const opts = parseSeedArgs(['--target', 'both', '--name', 'mari-tamm-pirita']);
    expect(opts.name).toBe('mari-tamm-pirita');
  });
});

describe('parseWipeArgs', () => {
  it('parses --target both', () => {
    const opts = parseWipeArgs(['--target', 'both']);
    expect(opts.targets).toEqual(['pipeagent', 'digital-pd-team']);
  });

  it('errors without --confirm unless --force', () => {
    expect(() => parseWipeArgs(['--target', 'pipeagent'])).toThrow(/confirm/);
  });

  it('accepts --confirm', () => {
    const opts = parseWipeArgs(['--target', 'pipeagent', '--confirm']);
    expect(opts.confirmed).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL with module-not-found error.

- [ ] **Step 3: Implement `src/args.ts`**

Create `~/git/pd-helpers/src/args.ts`:

```ts
import type { TargetName } from './types.js';

export type SeedOptions = {
  targets: TargetName[];
  dryRun: boolean;
  list: boolean;
  name: string | null;
};

export type WipeOptions = {
  targets: TargetName[];
  confirmed: boolean;
};

function getFlagValue(args: string[], flag: string): string | null {
  const i = args.indexOf(flag);
  if (i === -1) return null;
  const value = args[i + 1];
  if (value === undefined || value.startsWith('--')) return null;
  return value;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function resolveTargets(value: string | null): TargetName[] {
  if (value === null) {
    throw new Error('--target is required (one of: pipeagent, digital-pd-team, both)');
  }
  if (value === 'both') return ['pipeagent', 'digital-pd-team'];
  if (value === 'pipeagent') return ['pipeagent'];
  if (value === 'digital-pd-team') return ['digital-pd-team'];
  throw new Error(`invalid target "${value}" — expected pipeagent, digital-pd-team, or both`);
}

export function parseSeedArgs(argv: string[]): SeedOptions {
  return {
    targets: resolveTargets(getFlagValue(argv, '--target')),
    dryRun: hasFlag(argv, '--dry-run'),
    list: hasFlag(argv, '--list'),
    name: getFlagValue(argv, '--name'),
  };
}

export function parseWipeArgs(argv: string[]): WipeOptions {
  const targets = resolveTargets(getFlagValue(argv, '--target'));
  const confirmed = hasFlag(argv, '--confirm');
  if (!confirmed) {
    throw new Error('pd-wipe is destructive. Pass --confirm to proceed.');
  }
  return { targets, confirmed };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test
```

Expected: all tests pass — 20 total across 2 files (8 pool + 12 args).

- [ ] **Step 5: Commit**

```bash
git add src/args.ts tests/args.test.ts
git commit -m "feat: add CLI argument parser for seed and wipe commands"
```

---

## Task 5: Target config loader (TDD)

**Files:**
- Create: `~/git/pd-helpers/tests/targets.test.ts`
- Create: `~/git/pd-helpers/src/targets.ts`

- [ ] **Step 1: Write the failing test**

Create `~/git/pd-helpers/tests/targets.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadTargetConfig } from '../src/targets.js';

describe('loadTargetConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.PD_PIPEAGENT_API_TOKEN;
    delete process.env.PD_PIPEAGENT_API_DOMAIN;
    delete process.env.PD_DIGITAL_API_TOKEN;
    delete process.env.PD_DIGITAL_API_DOMAIN;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('loads pipeagent config from env', () => {
    process.env.PD_PIPEAGENT_API_TOKEN = 'tok_a';
    process.env.PD_PIPEAGENT_API_DOMAIN = 'https://api-a.example';
    const cfg = loadTargetConfig('pipeagent');
    expect(cfg).toEqual({
      name: 'pipeagent',
      token: 'tok_a',
      domain: 'https://api-a.example',
    });
  });

  it('loads digital-pd-team config from env', () => {
    process.env.PD_DIGITAL_API_TOKEN = 'tok_b';
    process.env.PD_DIGITAL_API_DOMAIN = 'https://api-b.example';
    const cfg = loadTargetConfig('digital-pd-team');
    expect(cfg).toEqual({
      name: 'digital-pd-team',
      token: 'tok_b',
      domain: 'https://api-b.example',
    });
  });

  it('throws when pipeagent token missing', () => {
    process.env.PD_PIPEAGENT_API_DOMAIN = 'https://api-a.example';
    expect(() => loadTargetConfig('pipeagent')).toThrow(/PD_PIPEAGENT_API_TOKEN/);
  });

  it('throws when pipeagent domain missing', () => {
    process.env.PD_PIPEAGENT_API_TOKEN = 'tok_a';
    expect(() => loadTargetConfig('pipeagent')).toThrow(/PD_PIPEAGENT_API_DOMAIN/);
  });

  it('throws when digital-pd-team token missing', () => {
    process.env.PD_DIGITAL_API_DOMAIN = 'https://api-b.example';
    expect(() => loadTargetConfig('digital-pd-team')).toThrow(/PD_DIGITAL_API_TOKEN/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL with missing module error.

- [ ] **Step 3: Implement `src/targets.ts`**

Create `~/git/pd-helpers/src/targets.ts`:

```ts
import type { TargetName, TargetConfig } from './types.js';

const ENV_KEYS: Record<TargetName, { token: string; domain: string }> = {
  pipeagent: {
    token: 'PD_PIPEAGENT_API_TOKEN',
    domain: 'PD_PIPEAGENT_API_DOMAIN',
  },
  'digital-pd-team': {
    token: 'PD_DIGITAL_API_TOKEN',
    domain: 'PD_DIGITAL_API_DOMAIN',
  },
};

export function loadTargetConfig(name: TargetName): TargetConfig {
  const keys = ENV_KEYS[name];
  const token = process.env[keys.token];
  const domain = process.env[keys.domain];

  if (!token) {
    throw new Error(
      `Missing environment variable ${keys.token}. Copy .env.example to .env and fill in credentials for the "${name}" account.`,
    );
  }
  if (!domain) {
    throw new Error(
      `Missing environment variable ${keys.domain}. Copy .env.example to .env and fill in credentials for the "${name}" account.`,
    );
  }

  return { name, token, domain };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test
```

Expected: all tests pass — 25 total (added 5 targets tests).

- [ ] **Step 5: Commit**

```bash
git add src/targets.ts tests/targets.test.ts
git commit -m "feat: add env-based target config loader"
```

---

## Task 6: Pipedrive REST client (TDD with mocked fetch)

**Files:**
- Create: `~/git/pd-helpers/tests/pd-client.test.ts`
- Create: `~/git/pd-helpers/src/pd-client.ts`

The client wraps Pipedrive's v1 REST API. Each method corresponds to one endpoint. Tests mock `global.fetch` via Vitest's `vi.fn()` so no network calls happen.

- [ ] **Step 1: Write the failing test**

Create `~/git/pd-helpers/tests/pd-client.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PDClient } from '../src/pd-client.js';

const CONFIG = {
  name: 'pipeagent' as const,
  token: 'test-token',
  domain: 'https://api.example.com',
};

function mockFetch(responses: Array<{ data: unknown; status?: number }>) {
  let callIndex = 0;
  const mock = vi.fn(async () => {
    const r = responses[callIndex++];
    if (!r) throw new Error(`Unexpected fetch call ${callIndex}`);
    return {
      ok: (r.status ?? 200) < 400,
      status: r.status ?? 200,
      json: async () => ({ success: true, data: r.data }),
      text: async () => JSON.stringify({ success: true, data: r.data }),
    } as Response;
  });
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

describe('PDClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('searches persons by email (exact)', async () => {
    const fetchMock = mockFetch([
      {
        data: {
          items: [
            { item: { id: 1, name: 'Mari Tamm', emails: ['mari.tamm@example.ee'] }, result_score: 1.0 },
          ],
        },
      },
    ]);
    const client = new PDClient(CONFIG);
    const result = await client.searchPersonsByEmail('mari.tamm@example.ee');

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    const url = (fetchMock.mock.calls[0]?.[0] as string) ?? '';
    expect(url).toContain('/persons/search');
    expect(url).toContain('term=mari.tamm%40example.ee');
    expect(url).toContain('fields=email');
    expect(url).toContain('exact_match=1');
  });

  it('gets open leads for a person', async () => {
    mockFetch([
      {
        data: [
          { id: 'abc-123', title: 'Mari Tamm — Pirita residential', person_id: 1, organization_id: 5, is_archived: false },
        ],
      },
    ]);
    const client = new PDClient(CONFIG);
    const leads = await client.getOpenLeadsForPerson(1);
    expect(leads).toHaveLength(1);
    expect(leads[0]?.id).toBe('abc-123');
  });

  it('filters out archived leads even if API returns them', async () => {
    mockFetch([
      {
        data: [
          { id: 'abc-123', title: 'X', person_id: 1, organization_id: null, is_archived: false },
          { id: 'xyz-789', title: 'Y', person_id: 1, organization_id: null, is_archived: true },
        ],
      },
    ]);
    const client = new PDClient(CONFIG);
    const leads = await client.getOpenLeadsForPerson(1);
    expect(leads).toHaveLength(1);
    expect(leads[0]?.id).toBe('abc-123');
  });

  it('gets open deals for a person', async () => {
    mockFetch([
      {
        data: [
          { id: 7, title: 'D1', status: 'open', person_id: 1 },
          { id: 8, title: 'D2', status: 'won', person_id: 1 },
        ],
      },
    ]);
    const client = new PDClient(CONFIG);
    const deals = await client.getOpenDealsForPerson(1);
    expect(deals).toHaveLength(1);
    expect(deals[0]?.id).toBe(7);
  });

  it('creates an organization', async () => {
    const fetchMock = mockFetch([{ data: { id: 42, name: 'NordLight Solar' } }]);
    const client = new PDClient(CONFIG);
    const org = await client.createOrganization({ name: 'NordLight Solar' });
    expect(org.id).toBe(42);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toContain('NordLight Solar');
  });

  it('creates a person with email and phone arrays', async () => {
    const fetchMock = mockFetch([{ data: { id: 99, name: 'Mari Tamm' } }]);
    const client = new PDClient(CONFIG);
    const person = await client.createPerson({
      name: 'Mari Tamm',
      email: 'mari@x.ee',
      phone: '+372 5555 0142',
      orgId: 42,
    });
    expect(person.id).toBe(99);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.email).toEqual([{ value: 'mari@x.ee', primary: true }]);
    expect(body.phone).toEqual([{ value: '+372 5555 0142', primary: true }]);
    expect(body.org_id).toBe(42);
  });

  it('creates a lead', async () => {
    mockFetch([
      { data: { id: 'lead-abc', title: 'Mari Tamm — Pirita', person_id: 99, organization_id: 42 } },
    ]);
    const client = new PDClient(CONFIG);
    const lead = await client.createLead({ title: 'Mari Tamm — Pirita', personId: 99, orgId: 42 });
    expect(lead.id).toBe('lead-abc');
  });

  it('archives a lead via PATCH', async () => {
    const fetchMock = mockFetch([{ data: { id: 'lead-abc', is_archived: true } }]);
    const client = new PDClient(CONFIG);
    await client.archiveLead('lead-abc');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('PATCH');
    expect(init.body).toContain('"is_archived":true');
  });

  it('deletes an organization', async () => {
    const fetchMock = mockFetch([{ data: { id: 42 } }]);
    const client = new PDClient(CONFIG);
    await client.deleteOrganization(42);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('DELETE');
  });

  it('lists all leads paginated', async () => {
    mockFetch([
      {
        data: [
          { id: 'l1', title: 'L1', person_id: 1, organization_id: 1, is_archived: false },
          { id: 'l2', title: 'L2', person_id: 2, organization_id: 2, is_archived: false },
        ],
      },
    ]);
    const client = new PDClient(CONFIG);
    const leads = await client.listLeads({ archived: false });
    expect(leads).toHaveLength(2);
  });

  it('throws with useful error on HTTP error', async () => {
    mockFetch([{ data: { error: 'Invalid token' }, status: 401 }]);
    const client = new PDClient(CONFIG);
    await expect(client.searchPersonsByEmail('x@y.com')).rejects.toThrow(/401/);
  });

  it('includes auth token as query param', async () => {
    const fetchMock = mockFetch([{ data: { items: [] } }]);
    const client = new PDClient(CONFIG);
    await client.searchPersonsByEmail('x@y.com');
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain('api_token=test-token');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement `src/pd-client.ts`**

Create `~/git/pd-helpers/src/pd-client.ts`:

```ts
import type {
  TargetConfig,
  PDPerson,
  PDOrganization,
  PDLead,
  PDDeal,
} from './types.js';

type PDResponse<T> = {
  success: boolean;
  data: T;
  error?: string;
};

export class PDClient {
  constructor(private readonly config: TargetConfig) {}

  private buildUrl(path: string, params: Record<string, string> = {}): string {
    const url = new URL(`${this.config.domain}/api/v1${path}`);
    url.searchParams.set('api_token', this.config.token);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url.toString();
  }

  private async request<T>(
    path: string,
    init: RequestInit & { params?: Record<string, string> } = {},
  ): Promise<T> {
    const { params, ...rest } = init;
    const url = this.buildUrl(path, params);
    const res = await fetch(url, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        ...rest.headers,
      },
    });

    if (!res.ok) {
      let detail = '';
      try {
        detail = await res.text();
      } catch {
        // ignore
      }
      throw new Error(
        `Pipedrive API ${res.status} ${res.statusText} on ${path}${detail ? ` — ${detail.slice(0, 200)}` : ''}`,
      );
    }

    const json = (await res.json()) as PDResponse<T>;
    return json.data;
  }

  async searchPersonsByEmail(email: string): Promise<PDPerson[]> {
    const result = await this.request<{
      items: Array<{ item: PDPerson; result_score: number }>;
    }>('/persons/search', {
      method: 'GET',
      params: {
        term: email,
        fields: 'email',
        exact_match: '1',
      },
    });
    return result.items.map((i) => i.item);
  }

  async getOpenLeadsForPerson(personId: number): Promise<PDLead[]> {
    const leads = await this.request<PDLead[]>(`/persons/${personId}/leads`, {
      method: 'GET',
      params: { limit: '100' },
    });
    return leads.filter((l) => !l.is_archived);
  }

  async getOpenDealsForPerson(personId: number): Promise<PDDeal[]> {
    const deals = await this.request<PDDeal[]>(`/persons/${personId}/deals`, {
      method: 'GET',
      params: { status: 'open', limit: '100' },
    });
    return deals.filter((d) => d.status === 'open');
  }

  async createOrganization(input: { name: string }): Promise<PDOrganization> {
    return this.request<PDOrganization>('/organizations', {
      method: 'POST',
      body: JSON.stringify({ name: input.name }),
    });
  }

  async createPerson(input: {
    name: string;
    email: string;
    phone: string;
    orgId: number;
  }): Promise<PDPerson> {
    return this.request<PDPerson>('/persons', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        email: [{ value: input.email, primary: true }],
        phone: [{ value: input.phone, primary: true }],
        org_id: input.orgId,
      }),
    });
  }

  async createLead(input: { title: string; personId: number; orgId: number }): Promise<PDLead> {
    return this.request<PDLead>('/leads', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        person_id: input.personId,
        organization_id: input.orgId,
      }),
    });
  }

  async archiveLead(leadId: string): Promise<void> {
    await this.request<PDLead>(`/leads/${leadId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_archived: true }),
    });
  }

  async deleteLead(leadId: string): Promise<void> {
    await this.request<{ id: string }>(`/leads/${leadId}`, {
      method: 'DELETE',
    });
  }

  async deleteOrganization(orgId: number): Promise<void> {
    await this.request<{ id: number }>(`/organizations/${orgId}`, {
      method: 'DELETE',
    });
  }

  async deletePerson(personId: number): Promise<void> {
    await this.request<{ id: number }>(`/persons/${personId}`, {
      method: 'DELETE',
    });
  }

  async listLeads(options: { archived: boolean }): Promise<PDLead[]> {
    const params: Record<string, string> = { limit: '500' };
    if (options.archived) params.archived_status = 'archived';
    else params.archived_status = 'not_archived';
    return this.request<PDLead[]>('/leads', {
      method: 'GET',
      params,
    });
  }

  async listPersons(): Promise<PDPerson[]> {
    return this.request<PDPerson[]>('/persons', {
      method: 'GET',
      params: { limit: '500' },
    });
  }

  async listOrganizations(): Promise<PDOrganization[]> {
    return this.request<PDOrganization[]>('/organizations', {
      method: 'GET',
      params: { limit: '500' },
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test
```

Expected: all tests pass — 37 total (added 12 pd-client tests).

- [ ] **Step 5: Commit**

```bash
git add src/pd-client.ts tests/pd-client.test.ts
git commit -m "feat: add PDClient with search, CRUD, and paginated list methods"
```

---

## Task 7: Email-based dedupe logic (TDD)

**Files:**
- Create: `~/git/pd-helpers/tests/dedupe.test.ts`
- Create: `~/git/pd-helpers/src/dedupe.ts`

- [ ] **Step 1: Write the failing test**

Create `~/git/pd-helpers/tests/dedupe.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { checkEmailInUse, pickAvailablePoolItem } from '../src/dedupe.js';
import type { PDPerson, PDLead, PDDeal } from '../src/types.js';
import type { PDClient } from '../src/pd-client.js';

function fakeClient(persons: {
  byEmail: Record<string, PDPerson[]>;
  openLeads: Record<number, PDLead[]>;
  openDeals: Record<number, PDDeal[]>;
}): PDClient {
  return {
    searchPersonsByEmail: vi.fn(async (email: string) => persons.byEmail[email] ?? []),
    getOpenLeadsForPerson: vi.fn(async (id: number) => persons.openLeads[id] ?? []),
    getOpenDealsForPerson: vi.fn(async (id: number) => persons.openDeals[id] ?? []),
  } as unknown as PDClient;
}

describe('checkEmailInUse', () => {
  it('reports not in use when no person matches', async () => {
    const client = fakeClient({ byEmail: {}, openLeads: {}, openDeals: {} });
    const result = await checkEmailInUse(client, 'mari@x.ee');
    expect(result.inUse).toBe(false);
    expect(result.reason).toBe(null);
  });

  it('reports in use when person has an open lead', async () => {
    const client = fakeClient({
      byEmail: { 'mari@x.ee': [{ id: 1, name: 'Mari' }] },
      openLeads: { 1: [{ id: 'abc', title: 'L', person_id: 1, organization_id: null, is_archived: false }] },
      openDeals: {},
    });
    const result = await checkEmailInUse(client, 'mari@x.ee');
    expect(result.inUse).toBe(true);
    expect(result.reason).toMatch(/open lead/);
  });

  it('reports in use when person has an open deal', async () => {
    const client = fakeClient({
      byEmail: { 'mari@x.ee': [{ id: 1, name: 'Mari' }] },
      openLeads: {},
      openDeals: { 1: [{ id: 7, title: 'D', status: 'open', person_id: 1 }] },
    });
    const result = await checkEmailInUse(client, 'mari@x.ee');
    expect(result.inUse).toBe(true);
    expect(result.reason).toMatch(/open deal/);
  });

  it('reports not in use when person exists but has no open leads or deals', async () => {
    const client = fakeClient({
      byEmail: { 'mari@x.ee': [{ id: 1, name: 'Mari' }] },
      openLeads: { 1: [] },
      openDeals: { 1: [] },
    });
    const result = await checkEmailInUse(client, 'mari@x.ee');
    expect(result.inUse).toBe(false);
  });

  it('checks all matched persons, not just the first', async () => {
    const client = fakeClient({
      byEmail: { 'mari@x.ee': [{ id: 1, name: 'Mari' }, { id: 2, name: 'Mari Dup' }] },
      openLeads: { 1: [], 2: [{ id: 'abc', title: 'L', person_id: 2, organization_id: null, is_archived: false }] },
      openDeals: {},
    });
    const result = await checkEmailInUse(client, 'mari@x.ee');
    expect(result.inUse).toBe(true);
  });
});

describe('pickAvailablePoolItem', () => {
  it('picks a specific item by slug when --name is given', async () => {
    const client = fakeClient({ byEmail: {}, openLeads: {}, openDeals: {} });
    const pool = [
      { slug: 'a', email: 'a@x.ee' } as any,
      { slug: 'b', email: 'b@x.ee' } as any,
    ];
    const item = await pickAvailablePoolItem({ pool, clients: [client], name: 'b' });
    expect(item.slug).toBe('b');
  });

  it('throws if the specific --name slug does not exist', async () => {
    const client = fakeClient({ byEmail: {}, openLeads: {}, openDeals: {} });
    const pool = [{ slug: 'a', email: 'a@x.ee' } as any];
    await expect(
      pickAvailablePoolItem({ pool, clients: [client], name: 'nonexistent' }),
    ).rejects.toThrow(/not found/);
  });

  it('throws if the --name slug is in use in any target', async () => {
    const client = fakeClient({
      byEmail: { 'a@x.ee': [{ id: 1, name: 'A' }] },
      openLeads: { 1: [{ id: 'l1', title: 'L', person_id: 1, organization_id: null, is_archived: false }] },
      openDeals: {},
    });
    const pool = [{ slug: 'a', email: 'a@x.ee' } as any];
    await expect(
      pickAvailablePoolItem({ pool, clients: [client], name: 'a' }),
    ).rejects.toThrow(/in use/);
  });

  it('picks randomly from available pool items when no --name', async () => {
    const client = fakeClient({ byEmail: {}, openLeads: {}, openDeals: {} });
    const pool = [
      { slug: 'a', email: 'a@x.ee' } as any,
      { slug: 'b', email: 'b@x.ee' } as any,
    ];
    const picked = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const item = await pickAvailablePoolItem({ pool, clients: [client], name: null });
      picked.add(item.slug);
    }
    expect(picked.size).toBeGreaterThanOrEqual(1);
    for (const slug of picked) expect(['a', 'b']).toContain(slug);
  });

  it('skips items in use in any target and picks an available one', async () => {
    const client = fakeClient({
      byEmail: {
        'a@x.ee': [{ id: 1, name: 'A' }],
      },
      openLeads: {
        1: [{ id: 'l1', title: 'L', person_id: 1, organization_id: null, is_archived: false }],
      },
      openDeals: {},
    });
    const pool = [
      { slug: 'a', email: 'a@x.ee' } as any,
      { slug: 'b', email: 'b@x.ee' } as any,
    ];
    const item = await pickAvailablePoolItem({ pool, clients: [client], name: null });
    expect(item.slug).toBe('b');
  });

  it('throws when every pool item is in use in at least one target', async () => {
    const client = fakeClient({
      byEmail: {
        'a@x.ee': [{ id: 1, name: 'A' }],
        'b@x.ee': [{ id: 2, name: 'B' }],
      },
      openLeads: {
        1: [{ id: 'l1', title: 'L', person_id: 1, organization_id: null, is_archived: false }],
        2: [{ id: 'l2', title: 'L2', person_id: 2, organization_id: null, is_archived: false }],
      },
      openDeals: {},
    });
    const pool = [
      { slug: 'a', email: 'a@x.ee' } as any,
      { slug: 'b', email: 'b@x.ee' } as any,
    ];
    await expect(
      pickAvailablePoolItem({ pool, clients: [client], name: null }),
    ).rejects.toThrow(/exhausted/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement `src/dedupe.ts`**

Create `~/git/pd-helpers/src/dedupe.ts`:

```ts
import type { SeedLead, InUseCheck } from './types.js';
import type { PDClient } from './pd-client.js';

export async function checkEmailInUse(client: PDClient, email: string): Promise<InUseCheck> {
  const persons = await client.searchPersonsByEmail(email);
  if (persons.length === 0) {
    return { inUse: false, reason: null };
  }

  for (const person of persons) {
    const [leads, deals] = await Promise.all([
      client.getOpenLeadsForPerson(person.id),
      client.getOpenDealsForPerson(person.id),
    ]);
    if (leads.length > 0) {
      return { inUse: true, reason: `open lead ${leads[0]?.id} for person #${person.id}` };
    }
    if (deals.length > 0) {
      return { inUse: true, reason: `open deal #${deals[0]?.id} for person #${person.id}` };
    }
  }

  return { inUse: false, reason: null };
}

export async function pickAvailablePoolItem(input: {
  pool: SeedLead[];
  clients: PDClient[];
  name: string | null;
}): Promise<SeedLead> {
  const { pool, clients, name } = input;

  // Specific slug requested
  if (name !== null) {
    const item = pool.find((p) => p.slug === name);
    if (!item) {
      throw new Error(`Pool item "${name}" not found. Available: ${pool.map((p) => p.slug).join(', ')}`);
    }
    for (const client of clients) {
      const check = await checkEmailInUse(client, item.email);
      if (check.inUse) {
        throw new Error(
          `Pool item "${name}" is in use in one target (${check.reason}). Pick a different --name or wipe first.`,
        );
      }
    }
    return item;
  }

  // Random selection — filter to items available in ALL targets
  const available: SeedLead[] = [];
  for (const item of pool) {
    let usable = true;
    for (const client of clients) {
      const check = await checkEmailInUse(client, item.email);
      if (check.inUse) {
        usable = false;
        break;
      }
    }
    if (usable) available.push(item);
  }

  if (available.length === 0) {
    throw new Error(
      `Pool exhausted — all ${pool.length} items are in use in at least one target. Run pd-wipe --target both --confirm to reset.`,
    );
  }

  const idx = Math.floor(Math.random() * available.length);
  return available[idx]!;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test
```

Expected: all tests pass — 48 total (added 11 dedupe tests).

- [ ] **Step 5: Commit**

```bash
git add src/dedupe.ts tests/dedupe.test.ts
git commit -m "feat: add email-based dedupe and pool item picker"
```

---

## Task 8: Seed orchestration core (TDD)

**Files:**
- Create: `~/git/pd-helpers/tests/seed-core.test.ts`
- Create: `~/git/pd-helpers/src/seed-core.ts`

- [ ] **Step 1: Write the failing test**

Create `~/git/pd-helpers/tests/seed-core.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { runSeed } from '../src/seed-core.js';
import type { PDClient } from '../src/pd-client.js';
import type { SeedLead, TargetConfig } from '../src/types.js';

const MOCK_POOL: SeedLead[] = [
  {
    slug: 'test-a',
    company: 'Test Co A',
    type: 'B2B',
    location: 'Tallinn',
    industry: 'Logistics',
    employees: 50,
    contactName: 'Alice',
    email: 'alice@test.com',
    phone: '+372 1',
    source: 'Source A',
    notes: '',
  },
  {
    slug: 'test-b',
    company: 'Test Co B',
    type: 'Residential',
    location: 'Tartu',
    industry: 'Residential',
    employees: null,
    contactName: 'Bob',
    email: 'bob@test.com',
    phone: '+372 2',
    source: 'Source B',
    notes: '',
  },
];

const TARGET_A: TargetConfig = { name: 'pipeagent', token: 't1', domain: 'https://a.example' };
const TARGET_B: TargetConfig = { name: 'digital-pd-team', token: 't2', domain: 'https://b.example' };

function mockClient(): PDClient {
  return {
    searchPersonsByEmail: vi.fn(async () => []),
    getOpenLeadsForPerson: vi.fn(async () => []),
    getOpenDealsForPerson: vi.fn(async () => []),
    createOrganization: vi.fn(async ({ name }) => ({ id: 100, name })),
    createPerson: vi.fn(async ({ name }) => ({ id: 200, name })),
    createLead: vi.fn(async ({ title, personId, orgId }) => ({
      id: 'lead-999',
      title,
      person_id: personId,
      organization_id: orgId,
      is_archived: false,
    })),
  } as unknown as PDClient;
}

describe('runSeed', () => {
  it('creates org + person + lead in a single target', async () => {
    const client = mockClient();
    const results = await runSeed({
      pool: MOCK_POOL,
      targets: [TARGET_A],
      name: 'test-a',
      dryRun: false,
      clientFactory: () => client,
    });

    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.target).toBe('pipeagent');
      expect(r.orgId).toBe(100);
      expect(r.personId).toBe(200);
      expect(r.leadId).toBe('lead-999');
    }
    expect(client.createOrganization).toHaveBeenCalledOnce();
    expect(client.createPerson).toHaveBeenCalledOnce();
    expect(client.createLead).toHaveBeenCalledOnce();
  });

  it('creates in both targets when --target both', async () => {
    const clientA = mockClient();
    const clientB = mockClient();
    const factory = vi.fn((cfg: TargetConfig) => (cfg.name === 'pipeagent' ? clientA : clientB));

    const results = await runSeed({
      pool: MOCK_POOL,
      targets: [TARGET_A, TARGET_B],
      name: 'test-a',
      dryRun: false,
      clientFactory: factory,
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.ok).toBe(true);
    expect(results[1]?.ok).toBe(true);
    expect(clientA.createOrganization).toHaveBeenCalledOnce();
    expect(clientB.createOrganization).toHaveBeenCalledOnce();
  });

  it('dry-run does not call any create methods', async () => {
    const client = mockClient();
    const results = await runSeed({
      pool: MOCK_POOL,
      targets: [TARGET_A],
      name: 'test-a',
      dryRun: true,
      clientFactory: () => client,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.ok).toBe(true);
    expect(client.createOrganization).not.toHaveBeenCalled();
    expect(client.createPerson).not.toHaveBeenCalled();
    expect(client.createLead).not.toHaveBeenCalled();
  });

  it('returns partial failure when one target succeeds and another fails', async () => {
    const clientA = mockClient();
    const clientB = mockClient();
    (clientB.createOrganization as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('403 Forbidden'),
    );

    const results = await runSeed({
      pool: MOCK_POOL,
      targets: [TARGET_A, TARGET_B],
      name: 'test-a',
      dryRun: false,
      clientFactory: (cfg) => (cfg.name === 'pipeagent' ? clientA : clientB),
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.ok).toBe(true);
    expect(results[1]?.ok).toBe(false);
    if (!results[1]!.ok) expect(results[1]!.error).toMatch(/403/);
  });

  it('uses the title format "{company} — {source}"', async () => {
    const client = mockClient();
    await runSeed({
      pool: MOCK_POOL,
      targets: [TARGET_A],
      name: 'test-a',
      dryRun: false,
      clientFactory: () => client,
    });
    const createLeadCall = (client.createLead as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(createLeadCall.title).toBe('Test Co A — Source A');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement `src/seed-core.ts`**

Create `~/git/pd-helpers/src/seed-core.ts`:

```ts
import type { SeedLead, TargetConfig, CreateResult } from './types.js';
import type { PDClient } from './pd-client.js';
import { pickAvailablePoolItem } from './dedupe.js';

export type RunSeedInput = {
  pool: SeedLead[];
  targets: TargetConfig[];
  name: string | null;
  dryRun: boolean;
  clientFactory: (config: TargetConfig) => PDClient;
};

export async function runSeed(input: RunSeedInput): Promise<CreateResult[]> {
  const { pool, targets, name, dryRun, clientFactory } = input;
  const clients = targets.map(clientFactory);

  const item = await pickAvailablePoolItem({ pool, clients, name });

  if (dryRun) {
    return targets.map((t) => ({
      target: t.name,
      ok: true as const,
      personId: -1,
      orgId: -1,
      leadId: `dry-run:${item.slug}`,
      title: `${item.company} — ${item.source}`,
    }));
  }

  const results: CreateResult[] = [];
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]!;
    const client = clients[i]!;
    try {
      const org = await client.createOrganization({ name: item.company });
      const person = await client.createPerson({
        name: item.contactName,
        email: item.email,
        phone: item.phone,
        orgId: org.id,
      });
      const lead = await client.createLead({
        title: `${item.company} — ${item.source}`,
        personId: person.id,
        orgId: org.id,
      });
      results.push({
        target: target.name,
        ok: true,
        personId: person.id,
        orgId: org.id,
        leadId: lead.id,
        title: lead.title,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ target: target.name, ok: false, error: msg });
    }
  }

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test
```

Expected: all tests pass — 53 total (added 5 seed-core tests).

- [ ] **Step 5: Commit**

```bash
git add src/seed-core.ts tests/seed-core.test.ts
git commit -m "feat: add seed orchestration core with dry-run and partial failures"
```

---

## Task 9: `pd-seed` CLI entrypoint

**Files:**
- Create: `~/git/pd-helpers/src/util.ts`
- Create: `~/git/pd-helpers/src/seed.ts`

The CLI entrypoint is a thin shim over `runSeed()` that handles arg parsing, env loading, rendering output, and exit codes. No test — this file is exercised manually via `pnpm dev:seed`.

- [ ] **Step 1: Create `src/util.ts` with exit code constants**

Create `~/git/pd-helpers/src/util.ts`:

```ts
export const EXIT_OK = 0;
export const EXIT_PARTIAL_FAILURE = 1;
export const EXIT_BAD_ARGS = 2;
export const EXIT_AUTH_FAILURE = 3;
export const EXIT_UNEXPECTED = 4;

export function formatResults(results: ReadonlyArray<{ target: string; ok: boolean; [key: string]: unknown }>): string {
  return results
    .map((r) => {
      if (r.ok) {
        return `[${r.target.padEnd(16)}] ✓ lead ${r.leadId} "${r.title}" (person #${r.personId}, org #${r.orgId})`;
      }
      return `[${r.target.padEnd(16)}] ✗ ${r.error}`;
    })
    .join('\n');
}
```

- [ ] **Step 2: Write `src/seed.ts` entrypoint**

Create `~/git/pd-helpers/src/seed.ts`:

```ts
#!/usr/bin/env node
import { parseSeedArgs } from './args.js';
import { loadTargetConfig } from './targets.js';
import { PDClient } from './pd-client.js';
import { POOL } from './pool.js';
import { runSeed } from './seed-core.js';
import { checkEmailInUse } from './dedupe.js';
import {
  EXIT_OK,
  EXIT_PARTIAL_FAILURE,
  EXIT_BAD_ARGS,
  EXIT_AUTH_FAILURE,
  EXIT_UNEXPECTED,
  formatResults,
} from './util.js';
import type { TargetConfig } from './types.js';

async function main(): Promise<number> {
  let opts;
  try {
    opts = parseSeedArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    console.error('');
    console.error('Usage: pd-seed --target <pipeagent|digital-pd-team|both> [--name <slug>] [--dry-run] [--list]');
    return EXIT_BAD_ARGS;
  }

  let targets: TargetConfig[];
  try {
    targets = opts.targets.map(loadTargetConfig);
  } catch (err) {
    console.error(`Auth error: ${err instanceof Error ? err.message : String(err)}`);
    return EXIT_AUTH_FAILURE;
  }

  // --list: show pool + per-target availability, no writes
  if (opts.list) {
    const clients = targets.map((t) => new PDClient(t));
    console.log(`Pool (${POOL.length} items) — availability per target:`);
    for (const item of POOL) {
      const status = await Promise.all(
        clients.map(async (c, i) => {
          const check = await checkEmailInUse(c, item.email);
          return `${targets[i]!.name}:${check.inUse ? '🔒' : '✓'}`;
        }),
      );
      console.log(`  ${item.slug.padEnd(30)} ${item.contactName.padEnd(20)} [${status.join(' ')}]`);
    }
    return EXIT_OK;
  }

  // Run the seed
  let results;
  try {
    results = await runSeed({
      pool: POOL,
      targets,
      name: opts.name,
      dryRun: opts.dryRun,
      clientFactory: (cfg) => new PDClient(cfg),
    });
  } catch (err) {
    console.error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    return EXIT_UNEXPECTED;
  }

  console.log(formatResults(results));

  const anyFailure = results.some((r) => !r.ok);
  return anyFailure ? EXIT_PARTIAL_FAILURE : EXIT_OK;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Fatal:', err);
    process.exit(EXIT_UNEXPECTED);
  });
```

- [ ] **Step 3: Verify typecheck**

```bash
cd ~/git/pd-helpers
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 4: Manual smoke test — dry-run**

**Prerequisite:** copy `.env.example` to `.env` and fill in both PD tokens.

```bash
cd ~/git/pd-helpers
cp .env.example .env
# Edit .env with real tokens for at least one account — use text editor
chmod 600 .env
pnpm dev:seed --target pipeagent --dry-run
```

Expected output format:
```
[pipeagent       ] ✓ lead dry-run:<slug> "<Company> — <Source>" (person #-1, org #-1)
```

Exit code: 0.

- [ ] **Step 5: Commit**

```bash
git add src/util.ts src/seed.ts
git commit -m "feat: add pd-seed CLI entrypoint with list, dry-run, and error exits"
```

---

## Task 10: Wipe orchestration core (TDD)

**Files:**
- Create: `~/git/pd-helpers/tests/wipe-core.test.ts`
- Create: `~/git/pd-helpers/src/wipe-core.ts`

- [ ] **Step 1: Write the failing test**

Create `~/git/pd-helpers/tests/wipe-core.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { runWipe } from '../src/wipe-core.js';
import type { PDClient } from '../src/pd-client.js';
import type { TargetConfig } from '../src/types.js';

const TARGET_A: TargetConfig = { name: 'pipeagent', token: 't1', domain: 'https://a.example' };

function mockClient(initial: {
  leads: Array<{ id: string; person_id: number | null; organization_id: number | null }>;
  persons: Array<{ id: number }>;
  orgs: Array<{ id: number }>;
}): PDClient {
  return {
    listLeads: vi.fn(async () => initial.leads.map((l) => ({ ...l, title: '', is_archived: false }))),
    listPersons: vi.fn(async () => initial.persons.map((p) => ({ ...p, name: '' }))),
    listOrganizations: vi.fn(async () => initial.orgs.map((o) => ({ ...o, name: '' }))),
    archiveLead: vi.fn(async () => undefined),
    deleteLead: vi.fn(async () => undefined),
    deletePerson: vi.fn(async () => undefined),
    deleteOrganization: vi.fn(async () => undefined),
  } as unknown as PDClient;
}

describe('runWipe', () => {
  it('deletes all leads, persons, and orgs from a single target', async () => {
    const client = mockClient({
      leads: [{ id: 'l1', person_id: 1, organization_id: 10 }, { id: 'l2', person_id: 2, organization_id: 20 }],
      persons: [{ id: 1 }, { id: 2 }],
      orgs: [{ id: 10 }, { id: 20 }],
    });

    const summary = await runWipe({
      targets: [TARGET_A],
      clientFactory: () => client,
    });

    expect(summary).toHaveLength(1);
    expect(summary[0]?.target).toBe('pipeagent');
    expect(summary[0]?.leadsDeleted).toBe(2);
    expect(summary[0]?.personsDeleted).toBe(2);
    expect(summary[0]?.orgsDeleted).toBe(2);
    expect(client.deleteLead).toHaveBeenCalledTimes(2);
    expect(client.deletePerson).toHaveBeenCalledTimes(2);
    expect(client.deleteOrganization).toHaveBeenCalledTimes(2);
  });

  it('deletes leads BEFORE persons (leads reference persons)', async () => {
    const callOrder: string[] = [];
    const client = mockClient({
      leads: [{ id: 'l1', person_id: 1, organization_id: 10 }],
      persons: [{ id: 1 }],
      orgs: [{ id: 10 }],
    });
    (client.deleteLead as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callOrder.push('lead');
    });
    (client.deletePerson as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callOrder.push('person');
    });
    (client.deleteOrganization as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      callOrder.push('org');
    });

    await runWipe({ targets: [TARGET_A], clientFactory: () => client });

    expect(callOrder.indexOf('lead')).toBeLessThan(callOrder.indexOf('person'));
    expect(callOrder.indexOf('person')).toBeLessThan(callOrder.indexOf('org'));
  });

  it('continues to next target if one fails', async () => {
    const goodClient = mockClient({ leads: [], persons: [], orgs: [] });
    const badClient = mockClient({ leads: [], persons: [], orgs: [] });
    (badClient.listLeads as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('auth'));

    const summary = await runWipe({
      targets: [
        { name: 'pipeagent', token: 't1', domain: 'https://a' },
        { name: 'digital-pd-team', token: 't2', domain: 'https://b' },
      ],
      clientFactory: (cfg) => (cfg.name === 'pipeagent' ? goodClient : badClient),
    });

    expect(summary).toHaveLength(2);
    expect(summary[0]?.error).toBeUndefined();
    expect(summary[1]?.error).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement `src/wipe-core.ts`**

Create `~/git/pd-helpers/src/wipe-core.ts`:

```ts
import type { TargetConfig } from './types.js';
import type { PDClient } from './pd-client.js';

export type WipeSummary = {
  target: string;
  leadsDeleted: number;
  personsDeleted: number;
  orgsDeleted: number;
  error?: string;
};

export type RunWipeInput = {
  targets: TargetConfig[];
  clientFactory: (config: TargetConfig) => PDClient;
};

export async function runWipe(input: RunWipeInput): Promise<WipeSummary[]> {
  const { targets, clientFactory } = input;
  const summaries: WipeSummary[] = [];

  for (const target of targets) {
    const client = clientFactory(target);
    try {
      // Delete leads first — they reference persons and orgs
      const [activeLeads, archivedLeads] = await Promise.all([
        client.listLeads({ archived: false }),
        client.listLeads({ archived: true }),
      ]);
      const allLeads = [...activeLeads, ...archivedLeads];
      for (const lead of allLeads) {
        await client.deleteLead(lead.id);
      }

      // Then persons
      const persons = await client.listPersons();
      for (const person of persons) {
        await client.deletePerson(person.id);
      }

      // Then orgs
      const orgs = await client.listOrganizations();
      for (const org of orgs) {
        await client.deleteOrganization(org.id);
      }

      summaries.push({
        target: target.name,
        leadsDeleted: allLeads.length,
        personsDeleted: persons.length,
        orgsDeleted: orgs.length,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summaries.push({
        target: target.name,
        leadsDeleted: 0,
        personsDeleted: 0,
        orgsDeleted: 0,
        error: msg,
      });
    }
  }

  return summaries;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test
```

Expected: all tests pass — 56 total (added 3 wipe-core tests).

- [ ] **Step 5: Commit**

```bash
git add src/wipe-core.ts tests/wipe-core.test.ts
git commit -m "feat: add wipe orchestration core with dependency-ordered deletion"
```

---

## Task 11: `pd-wipe` CLI entrypoint

**Files:**
- Create: `~/git/pd-helpers/src/wipe.ts`

- [ ] **Step 1: Write `src/wipe.ts`**

Create `~/git/pd-helpers/src/wipe.ts`:

```ts
#!/usr/bin/env node
import { parseWipeArgs } from './args.js';
import { loadTargetConfig } from './targets.js';
import { PDClient } from './pd-client.js';
import { runWipe } from './wipe-core.js';
import {
  EXIT_OK,
  EXIT_PARTIAL_FAILURE,
  EXIT_BAD_ARGS,
  EXIT_AUTH_FAILURE,
  EXIT_UNEXPECTED,
} from './util.js';
import type { TargetConfig } from './types.js';

async function main(): Promise<number> {
  let opts;
  try {
    opts = parseWipeArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    console.error('');
    console.error('Usage: pd-wipe --target <pipeagent|digital-pd-team|both> --confirm');
    console.error('  DANGER: this deletes ALL leads, persons, and organizations in the target account(s).');
    return EXIT_BAD_ARGS;
  }

  let targets: TargetConfig[];
  try {
    targets = opts.targets.map(loadTargetConfig);
  } catch (err) {
    console.error(`Auth error: ${err instanceof Error ? err.message : String(err)}`);
    return EXIT_AUTH_FAILURE;
  }

  console.log(`Wiping ${targets.length} target(s): ${targets.map((t) => t.name).join(', ')}`);

  let summaries;
  try {
    summaries = await runWipe({
      targets,
      clientFactory: (cfg) => new PDClient(cfg),
    });
  } catch (err) {
    console.error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    return EXIT_UNEXPECTED;
  }

  for (const s of summaries) {
    if (s.error) {
      console.log(`[${s.target.padEnd(16)}] ✗ ${s.error}`);
    } else {
      console.log(
        `[${s.target.padEnd(16)}] ✓ deleted ${s.leadsDeleted} leads, ${s.personsDeleted} persons, ${s.orgsDeleted} orgs`,
      );
    }
  }

  const anyFailure = summaries.some((s) => s.error !== undefined);
  return anyFailure ? EXIT_PARTIAL_FAILURE : EXIT_OK;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Fatal:', err);
    process.exit(EXIT_UNEXPECTED);
  });
```

- [ ] **Step 2: Verify typecheck**

```bash
cd ~/git/pd-helpers
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/wipe.ts
git commit -m "feat: add pd-wipe CLI entrypoint"
```

---

## Task 12: Prewarm orchestration core (TDD)

The prewarm script fires seed leads through pipeagent's webhook endpoint to populate the `org_memory` cache before a demo, so research steps hit cache instead of running live.

**Files:**
- Create: `~/git/pd-helpers/tests/prewarm-core.test.ts`
- Create: `~/git/pd-helpers/src/prewarm-core.ts`

- [ ] **Step 1: Write the failing test**

Create `~/git/pd-helpers/tests/prewarm-core.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPrewarm } from '../src/prewarm-core.js';
import type { PDClient } from '../src/pd-client.js';
import type { SeedLead, TargetConfig } from '../src/types.js';

const POOL: SeedLead[] = [
  { slug: 'a', company: 'CoA', type: 'B2B', location: 'X', industry: 'I', employees: 10, contactName: 'A', email: 'a@x.ee', phone: '1', source: 'S', notes: '' },
  { slug: 'b', company: 'CoB', type: 'B2B', location: 'X', industry: 'I', employees: 10, contactName: 'B', email: 'b@x.ee', phone: '2', source: 'S', notes: '' },
];

const TARGET: TargetConfig = { name: 'pipeagent', token: 't', domain: 'https://a' };

function okClient(): PDClient {
  return {
    searchPersonsByEmail: vi.fn(async () => []),
    getOpenLeadsForPerson: vi.fn(async () => []),
    getOpenDealsForPerson: vi.fn(async () => []),
    createOrganization: vi.fn(async () => ({ id: 1, name: 'X' })),
    createPerson: vi.fn(async () => ({ id: 2, name: 'X' })),
    createLead: vi.fn(async ({ title }) => ({
      id: `lead-${Math.random()}`,
      title,
      person_id: 2,
      organization_id: 1,
      is_archived: false,
    })),
  } as unknown as PDClient;
}

describe('runPrewarm', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({}),
    } as unknown as Response));
  });

  it('seeds each pool item and fires the pipeagent webhook', async () => {
    const client = okClient();
    const summary = await runPrewarm({
      pool: POOL,
      target: TARGET,
      webhookUrl: 'https://pipeagent.example/webhooks/pipedrive',
      count: 2,
      delayMs: 0,
      clientFactory: () => client,
    });

    expect(summary.fired).toBe(2);
    expect(client.createLead).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const firstFetchArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(firstFetchArgs?.[0]).toBe('https://pipeagent.example/webhooks/pipedrive');
    const init = firstFetchArgs?.[1] as RequestInit;
    expect(init.method).toBe('POST');
  });

  it('respects the --count limit', async () => {
    const client = okClient();
    const summary = await runPrewarm({
      pool: POOL,
      target: TARGET,
      webhookUrl: 'https://x/webhook',
      count: 1,
      delayMs: 0,
      clientFactory: () => client,
    });
    expect(summary.fired).toBe(1);
  });

  it('sends a webhook payload that matches Pipedrive lead.added shape', async () => {
    const client = okClient();
    await runPrewarm({
      pool: POOL.slice(0, 1),
      target: TARGET,
      webhookUrl: 'https://x/webhook',
      count: 1,
      delayMs: 0,
      clientFactory: () => client,
    });

    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      event: 'added.lead',
      meta: expect.objectContaining({
        action: expect.stringMatching(/added|create/),
        object: 'lead',
        id: expect.anything(),
      }),
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL with missing module.

- [ ] **Step 3: Implement `src/prewarm-core.ts`**

Create `~/git/pd-helpers/src/prewarm-core.ts`:

```ts
import type { SeedLead, TargetConfig } from './types.js';
import type { PDClient } from './pd-client.js';

export type PrewarmSummary = {
  fired: number;
  errors: Array<{ slug: string; error: string }>;
};

export type RunPrewarmInput = {
  pool: SeedLead[];
  target: TargetConfig;
  webhookUrl: string;
  count: number;
  delayMs: number;
  clientFactory: (config: TargetConfig) => PDClient;
};

export async function runPrewarm(input: RunPrewarmInput): Promise<PrewarmSummary> {
  const { pool, target, webhookUrl, count, delayMs, clientFactory } = input;
  const client = clientFactory(target);

  const selected = pool.slice(0, Math.min(count, pool.length));
  let fired = 0;
  const errors: Array<{ slug: string; error: string }> = [];

  for (const item of selected) {
    try {
      // Create person + org + lead in the target Pipedrive account
      const org = await client.createOrganization({ name: item.company });
      const person = await client.createPerson({
        name: item.contactName,
        email: item.email,
        phone: item.phone,
        orgId: org.id,
      });
      const lead = await client.createLead({
        title: `${item.company} — ${item.source}`,
        personId: person.id,
        orgId: org.id,
      });

      // Fire a fake webhook to pipeagent so it kicks off the graph
      const payload = {
        event: 'added.lead',
        meta: {
          action: 'added',
          object: 'lead',
          id: lead.id,
          user_id: 0,
          company_id: 0,
          timestamp: new Date().toISOString(),
        },
        data: {
          id: lead.id,
          title: lead.title,
          person_id: person.id,
          organization_id: org.id,
        },
      };

      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`webhook returned ${res.status}`);
      }

      fired++;
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    } catch (err) {
      errors.push({
        slug: item.slug,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { fired, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test
```

Expected: all tests pass — 59 total (added 3 prewarm-core tests).

- [ ] **Step 5: Commit**

```bash
git add src/prewarm-core.ts tests/prewarm-core.test.ts
git commit -m "feat: add prewarm core that seeds leads and fires webhooks"
```

---

## Task 13: `pd-prewarm` CLI entrypoint

**Files:**
- Create: `~/git/pd-helpers/src/prewarm.ts`

- [ ] **Step 1: Write `src/prewarm.ts`**

Create `~/git/pd-helpers/src/prewarm.ts`:

```ts
#!/usr/bin/env node
import { loadTargetConfig } from './targets.js';
import { PDClient } from './pd-client.js';
import { POOL } from './pool.js';
import { runPrewarm } from './prewarm-core.js';
import {
  EXIT_OK,
  EXIT_PARTIAL_FAILURE,
  EXIT_BAD_ARGS,
  EXIT_AUTH_FAILURE,
  EXIT_UNEXPECTED,
} from './util.js';
import type { TargetName } from './types.js';

function parsePrewarmArgs(argv: string[]): {
  target: TargetName;
  count: number;
  delayMs: number;
} {
  const targetIdx = argv.indexOf('--target');
  if (targetIdx === -1 || !argv[targetIdx + 1]) {
    throw new Error('--target is required (pipeagent or digital-pd-team)');
  }
  const targetVal = argv[targetIdx + 1]!;
  if (targetVal !== 'pipeagent' && targetVal !== 'digital-pd-team') {
    throw new Error(`invalid target "${targetVal}"`);
  }

  const countIdx = argv.indexOf('--count');
  const count = countIdx !== -1 && argv[countIdx + 1] ? parseInt(argv[countIdx + 1]!, 10) : 15;
  if (isNaN(count) || count < 1) throw new Error('--count must be a positive integer');

  const delayIdx = argv.indexOf('--delay');
  const delayMs =
    delayIdx !== -1 && argv[delayIdx + 1] ? parseInt(argv[delayIdx + 1]!, 10) : 3000;
  if (isNaN(delayMs) || delayMs < 0) throw new Error('--delay must be a non-negative integer');

  return { target: targetVal, count, delayMs };
}

async function main(): Promise<number> {
  let opts;
  try {
    opts = parsePrewarmArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    console.error('');
    console.error('Usage: pd-prewarm --target <pipeagent|digital-pd-team> [--count N] [--delay MS]');
    console.error('  --count defaults to 15, --delay defaults to 3000ms.');
    console.error('  Requires PIPEAGENT_WEBHOOK_URL env var.');
    return EXIT_BAD_ARGS;
  }

  const webhookUrl = process.env.PIPEAGENT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error('Missing PIPEAGENT_WEBHOOK_URL env var (e.g. https://pipeagent.xtian.me/webhooks/pipedrive)');
    return EXIT_BAD_ARGS;
  }

  let target;
  try {
    target = loadTargetConfig(opts.target);
  } catch (err) {
    console.error(`Auth error: ${err instanceof Error ? err.message : String(err)}`);
    return EXIT_AUTH_FAILURE;
  }

  console.log(`Prewarming ${opts.count} leads into ${opts.target} (${opts.delayMs}ms delay between each)...`);

  let summary;
  try {
    summary = await runPrewarm({
      pool: POOL,
      target,
      webhookUrl,
      count: opts.count,
      delayMs: opts.delayMs,
      clientFactory: (cfg) => new PDClient(cfg),
    });
  } catch (err) {
    console.error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
    return EXIT_UNEXPECTED;
  }

  console.log(`✓ fired ${summary.fired} leads into pipeagent webhook`);
  for (const e of summary.errors) {
    console.log(`✗ ${e.slug}: ${e.error}`);
  }

  return summary.errors.length > 0 ? EXIT_PARTIAL_FAILURE : EXIT_OK;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('Fatal:', err);
    process.exit(EXIT_UNEXPECTED);
  });
```

- [ ] **Step 2: Verify typecheck**

```bash
cd ~/git/pd-helpers
pnpm typecheck
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/prewarm.ts
git commit -m "feat: add pd-prewarm CLI entrypoint"
```

---

## Task 14: README

**Files:**
- Create: `~/git/pd-helpers/README.md`

- [ ] **Step 1: Write `README.md`**

Create `~/git/pd-helpers/README.md`:

````markdown
# pd-helpers

Shared Pipedrive helpers for [`pipeagent`](https://github.com/... /pipeagent) and [`digital-pd-team`](https://github.com/... /digital-pd-team). Currently provides a 20-item seed lead pool and three CLI commands: `pd-seed`, `pd-wipe`, `pd-prewarm`.

**Status:** local dev only. Not published. Run via `pnpm dev:*` scripts.

## Setup

```bash
cd ~/git/pd-helpers
pnpm install
cp .env.example .env
chmod 600 .env
# Edit .env with API tokens from each Pipedrive account
```

Get your API token from Pipedrive: Settings → Personal → API.

## Commands

### `pd-seed`

Pick a random lead from the pool and create it in one or both Pipedrive accounts.

```bash
pnpm dev:seed --target pipeagent
pnpm dev:seed --target digital-pd-team
pnpm dev:seed --target both
pnpm dev:seed --target both --name mari-tamm-pirita     # specific slug
pnpm dev:seed --target both --dry-run                    # no writes, just pick
pnpm dev:seed --target both --list                       # show pool + per-target availability
```

Dedupe: a pool item is "in use" if its email matches a person who has any open lead or open deal in the target account. When every pool item is in use, `pd-seed` errors with `pool exhausted`. Run `pd-wipe` to reset.

### `pd-wipe`

Destructive. Deletes all leads, persons, and organizations in the target account(s). Used before a demo rehearsal to reset state.

```bash
pnpm dev:wipe --target both --confirm
```

Requires `--confirm`. Order: leads → persons → orgs (so references resolve).

### `pd-prewarm`

Seeds 15 leads into one Pipedrive account and fires the pipeagent webhook for each, so pipeagent's `org_memory` cache fills with research. After prewarm, demo runs hit the cache and skip live research — makes stage pacing predictable.

```bash
pnpm dev:prewarm --target pipeagent --count 15 --delay 3000
```

Requires `PIPEAGENT_WEBHOOK_URL` env var. Defaults: count 15, delay 3000ms between each.

## Testing

```bash
pnpm test          # run once
pnpm test:watch    # watch mode
pnpm typecheck     # tsc --noEmit
```

All tests mock `fetch`; no live Pipedrive calls in the test suite.

## Architecture

- `src/pool.ts` — the 20-item seed pool (lifted from `pipeagent/apps/server/src/seed/companies.ts`).
- `src/pd-client.ts` — thin Pipedrive v1 REST wrapper, `fetch`-based.
- `src/dedupe.ts` — email-based "is this in use?" check.
- `src/*-core.ts` — pure orchestration (testable, dependency-injected client).
- `src/seed.ts` / `src/wipe.ts` / `src/prewarm.ts` — CLI entrypoints (thin shims).

## Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Partial failure (one target succeeded, another failed) |
| 2 | Bad arguments |
| 3 | Auth failure (missing env vars) |
| 4 | Unexpected error |

## License

Private / internal.
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup, commands, and architecture notes"
```

---

## Task 15: End-to-end verification against a real Pipedrive account

This task is manual and exercises the full CLI against at least one live Pipedrive account. **Do this only when you have a disposable test account** — `pd-wipe` is destructive.

- [ ] **Step 1: Seed a lead (dry-run first)**

```bash
cd ~/git/pd-helpers
pnpm dev:seed --target pipeagent --dry-run
```

Expected: prints one `[pipeagent] ✓ lead dry-run:<slug> "<Company> — <Source>"` line. Exit 0.

- [ ] **Step 2: Check pool availability**

```bash
pnpm dev:seed --target pipeagent --list
```

Expected: prints all 20 pool items with `[pipeagent:✓]` or `[pipeagent:🔒]` next to each.

- [ ] **Step 3: Seed a real lead**

```bash
pnpm dev:seed --target pipeagent
```

Expected: prints one success line with real lead ID, person ID, org ID. Exit 0.

- [ ] **Step 4: Verify in Pipedrive UI**

Open Pipedrive for the pipeagent account in a browser. Navigate to Leads Inbox. Confirm the new lead appears with title matching the expected `{company} — {source}` format.

- [ ] **Step 5: Verify dedupe catches the same item**

```bash
pnpm dev:seed --target pipeagent --name <slug-of-the-one-you-just-created>
```

Expected: error message `Pool item "<slug>" is in use in one target (open lead <id> ...)`. Exit 1.

- [ ] **Step 6: Wipe and re-verify availability**

```bash
pnpm dev:wipe --target pipeagent --confirm
pnpm dev:seed --target pipeagent --list
```

Expected: wipe prints deletion counts. List then shows all 20 items as `[pipeagent:✓]` again.

- [ ] **Step 7: Build the dist**

```bash
pnpm build
ls dist/
```

Expected: `dist/` contains `seed.js`, `wipe.js`, `prewarm.js`, plus `.d.ts` files.

- [ ] **Step 8: Commit any small fixes discovered during live verification**

```bash
git add -A
git commit -m "fix: <describe any issue found during live verification>" # only if needed
```

If nothing needed fixing, skip this step.

---

## Final sanity checklist

After Task 15, confirm:

- [ ] `pnpm test` passes (~59 tests across 8 test files)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` produces `dist/`
- [ ] `pd-seed`, `pd-wipe`, `pd-prewarm` all work against a real account
- [ ] `git log --oneline` shows ~15 clean commits
- [ ] README is accurate and up to date
- [ ] `.env` is NOT committed (verify with `git ls-files | grep env`)

When all boxes checked, Plan A is complete. Move to Plan B (pipeagent redesign).
