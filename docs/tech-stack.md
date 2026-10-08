# Personal Memory App --- Tech Stack

**Status:** Draft for implementation\
**Version:** 1.0\
**Date:** 2026-10-08\
**Purpose:** Define the implementation technologies and the boundaries
that keep them replaceable. Volatile provider limits and terms are
explicitly marked VERIFY.

**Top principle:**\
\> **The application must remain useful when AI, the backend, and the
internet are unavailable. AI enhances captured data; it does not own the
capture workflow.**

## 1. Stack overview

``` mermaid
flowchart TB
UI["React + TypeScript + Vite"] --> TW["Tailwind CSS + shadcn/ui"]
UI --> TQ["TanStack Query"]
UI --> DX["Dexie / IndexedDB"]
UI --> PWA["vite-plugin-pwa"]
UI --> SB["Supabase Auth/Postgres"]
UI --> API["FastAPI"]
API --> AI["AIProvider"]
API --> META["URL metadata fetcher"]
```

## 2. Technology decisions

  ------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Technology   Choice / version policy    Role               Why                     Alternatives         Cost/terms         Replaceability   Revisit trigger
  ------------ -------------------------- ------------------ ----------------------- -------------------- ------------------ ---------------- ----------------------
  Frontend     React + TypeScript; pin    UI                 Component model + type  Vue, Svelte          Open source        Easy             Team or performance
               compatible minor versions                     safety; FR-01                                                                    evidence

  Build        Vite; pin major            Build/dev server   Simple SPA/PWA; NFR-07  Next.js, Parcel      Open source        Easy             SSR/public SEO becomes
                                                                                                                                              required

  Styling      Tailwind CSS; pin major    Styling            Precise minimal UI;     CSS Modules, UnoCSS  Open source        Moderate         Styling workflow
                                                             DP-01..08                                                                        becomes limiting

  Components   shadcn/ui                  Base UI components Ownable/customizable,   Radix directly, MUI  Open source        Easy             Component maintenance
                                                             minimal visual language                                                          burden

  Icons        Lucide React               Icons              Consistent restrained   Heroicons            Open source        Easy             None expected
                                                             iconography                                                                      

  Server state TanStack Query             Remote cache/state Direct Supabase + API   SWR, Redux Toolkit   Open source        Easy             Real-time complexity
                                                             data                                                                             

  Local DB     Dexie/IndexedDB            Offline            Browser-native          idb, localForage     Open source        Moderate         Native wrapper
                                          capture/outbox     persistence; NFR-02                                                              required

  PWA          vite-plugin-pwa            Install/offline    Android/iOS/desktop     Workbox direct       Open source        Easy             Native features
                                          shell              install goal                                                                     require wrapper

  Backend      FastAPI                    URL/AI/embedding   Python + Pydantic;      Express, Flask       Open source        Moderate         Runtime constraints
                                          APIs               isolated specialized                                                             
                                                             services                                                                         

  HTTP         httpx                      Backend HTTP       Async requests and      aiohttp, requests    Open source        Easy             None
                                                             timeouts                                                                         

  HTML parser  selectolax/BeautifulSoup   Metadata           Parse public pages      lxml                 Open source        Easy             Need JS-rendered pages
                                          extraction                                                                                          

  DB           Supabase PostgreSQL        Durable storage    Postgres + Auth + RLS;  Neon + custom auth,  VERIFY current     Moderate         Free limits or scale
                                                             FR-29                   SQLite               free terms                          

  Auth         Supabase Auth              Identity           JWT/RLS integration     Auth.js, Clerk       VERIFY current     Moderate         Need non-Supabase auth
                                                                                                          terms                               

  Hosting      Vercel                     PWA hosting        Simple React deployment Cloudflare Pages,    VERIFY current     Easy             Commercial/public
  frontend                                                                           Netlify              limits/terms                        release

  Hosting API  Render                     FastAPI            Simple Python hosting   Railway, Fly.io,     VERIFY current     Easy             Cold starts or free
                                          specialized                                Cloud Run            free terms                          tier removed
                                          services                                                                                            

  AI           GeminiProvider first       Classification     Lightweight structured  Groq,                VERIFY current     Easy via         Privacy/terms/limits
                                                             classification          OpenAI-compatible,   data-use and       interface        
                                                                                     local                quotas                              

  Search       PostgreSQL FTS             Primary search     No extra service; FR-18 Meilisearch,         Open               Easy             FTS fails golden tests
                                                                                     Typesense            source/self-host                    

  Tests        Pytest + Vitest +          Quality            Backend/unit/E2E        Jest, Cypress        Open source        Easy             None
               Playwright                                                                                                                     

  CI           GitHub Actions             CI                 Native GitHub workflow  GitLab CI            VERIFY private     Easy             CI cost/limits
                                                                                                          repo allowance                      

  Error        Sentry                     Frontend errors    Useful diagnostics      OpenTelemetry only   VERIFY free        Easy             Privacy requirements
  tracking                                                                                                plan/terms                          

  Formatting   Ruff + Prettier            Formatting/lint    Python + TS consistency Biome, ESLint        Open source        Easy             Unified tool becomes
                                                                                                                                              useful

  Validation   Pydantic + Zod where       Schema validation  AI/API/input validation JSON Schema          Open source        Easy             Generated API client
               needed                                                                                                                         
  ------------------------------------------------------------------------------------------------------------------------------------------------------------------

## 3. Version policy

-   Pin major versions.
-   Lock exact dependency versions in lockfiles.
-   Upgrade one ecosystem at a time.
-   Security patches can move independently.
-   Every major dependency upgrade runs CI and offline sync tests.
-   Do not upgrade Vite, React, Supabase client, Dexie, or FastAPI
    simultaneously.

## 4. Why this stack

The stack directly supports the requirements: - React/Vite: responsive
PWA and minimal UI. - Tailwind/shadcn/Lucide: typography-led visual
system. - Dexie/IndexedDB: offline capture. - Supabase/RLS: private user
data. - FastAPI: specialized AI/URL processing without making capture
dependent on it. - PostgreSQL FTS: simple first search. - AIProvider:
provider replacement.

## 5. Free-tier map

  --------------------------------------------------------------------------------
  Service           Role              Current information       Status
  ----------------- ----------------- ------------------------- ------------------
  Vercel Hobby      Frontend          \$0 plan;                 VERIFY terms
                                      personal/non-commercial   before public
                                      use                       release

  Supabase Free     DB/Auth/Storage   Current docs list 500 MB  VERIFY at
                                      database, 1 GB storage,   development time
                                      50k MAU, 5 GB egress      

  Render Free       FastAPI           Exact current             VERIFY official
                                      limits/terms can change   free-tier docs
                                                                before deployment

  Gemini API        AI                Current pricing page      VERIFY
                                      shows free-tier           privacy/data-use
                                      availability for several  policy before any
                                      models and states         private content
                                      free-tier content may be  
                                      used to improve products  

  GitHub Actions    CI                Standard GitHub-hosted    VERIFY for this
                                      runners are free for      repository
                                      public repositories;      
                                      private repositories have 
                                      plan quotas               

  Sentry            Error tracking    Free availability/limits  VERIFY before
                                      change                    adoption
  --------------------------------------------------------------------------------

Current official references checked: - Vercel pricing:
https://vercel.com/pricing - Vercel terms:
https://vercel.com/legal/terms - Supabase billing:
https://supabase.com/docs/guides/platform/billing-on-supabase - Gemini
pricing: https://ai.google.dev/gemini-api/docs/pricing - GitHub Actions
billing: https://docs.github.com/en/actions/concepts/billing-and-usage -
Web Share Target reference:
https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target

## 6. AI provider policy

Gemini is only the first provider implementation. The application must
expose:

``` text
AIProvider
  classify(input, context)
```

Provider-specific code stays under `services/ai/providers/`.

**Important privacy decision:** the current Gemini pricing documentation
says free-tier content may be used to improve Google's products.
Therefore Level 2 personal content and Level 3 sensitive notes must not
be sent to Gemini merely because AI is globally enabled. Recheck the
current policy before enabling those levels.

## 7. Deferred technologies

  Technology               Trigger
  ------------------------ --------------------------------------------------
  Zustand                  React state becomes materially difficult
  React Hook Form          Complex multi-field forms appear
  Heavy calendar library   Drag/drop/recurrence becomes required
  Graph library            User has enough relationships to benefit
  pgvector                 FTS misses real search cases
  Block editor             Markdown becomes limiting
  Neo4j                    PostgreSQL relationship model demonstrably fails
  React Native             PWA cannot meet a required native capability

## 8. Dependency policy

A new runtime dependency requires: 1. clear requirement/issue, 2.
alternatives considered, 3. security/license check, 4. bundle/runtime
impact assessment, 5. decision record if architectural.

Run: - frontend dependency audit, - Python dependency audit, - secret
scanning, - lockfile review.

## 9. Developer tooling

Recommended:

``` text
Node: active LTS
Python: supported 3.x minor pinned per backend
Package manager: npm; commit package-lock.json
Python env: uv or pip + requirements lock
Editor: VS Code-compatible
Git hooks: optional pre-commit
CI: GitHub Actions
```

**DECISION:** use `npm` for the web workspace and `uv` for Python
unless the implementation environment requires otherwise.

## 10. Cost

MVP target:

``` text
Frontend: $0 target
Database/Auth: $0 target
Backend: $0 target
AI: $0 target for public/low-risk AI use
CI: $0 target
Domain: optional paid item
```

A hard monthly ceiling should be set before enabling paid AI or hosting.

## Assumptions

-   **ASSUMPTION T-01:** Vercel remains acceptable for a
    personal/non-commercial MVP.
-   **ASSUMPTION T-02:** Supabase Free remains sufficient for personal
    data volume.
-   **ASSUMPTION T-03:** Gemini is acceptable for Level 1
    public-resource enrichment after policy verification.
-   **ASSUMPTION T-04:** No paid AI or hosting is enabled automatically.

## Open questions

-   Exact package manager.
-   Exact supported Node/Python versions after Phase 0 environment
    setup.
-   Exact Sentry adoption after privacy review.

## Objections

**T-OBJ-01:** Free-tier infrastructure is inherently subject to provider
changes. The architecture deliberately treats these providers as
replaceable deployment targets, not permanent dependencies.
