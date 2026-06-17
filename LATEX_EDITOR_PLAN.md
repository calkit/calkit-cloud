# LaTeX Editor ("Overleaf replacement") — Implementation Plan

## Goal

Let a user open a publication on the publications page, click **Edit**, and get a
full-screen, closable LaTeX editor — an "app within Calkit" — where:

- The `.tex` source is edited in a code editor (Overleaf-like split view).
- Compilation to PDF happens **client-side in WebAssembly** (no compile server).
- Changes flow back into the project's git repo. We start with **auto-git-commit**
  (matching the existing `PUT contents` behavior) and later move to an
  **editing-session = branch** model that squashes into a single project commit.
- The feel is collaborative, but the styling is our own (Chakra UI), not an Overleaf clone.
- **Onboarding is as easy as Overleaf**: sign up with Google / email / university SSO, join
  a project via a shareable link, and start editing **with no GitHub account** — edits still
  land as real commits in the project repo. This requires decoupling identity from GitHub
  (see §2) and is as important to the goal as the editor itself.

We want to reuse compilation code from [TeXlyre](https://github.com/TeXlyre/texlyre)
where it makes sense, but with eyes open about licensing (see below). Calkit is open source
(MIT), which shapes both the licensing and self-hosting choices below.

---

## Decisions log

Settled during planning (see referenced sections for rationale):

| Topic | Decision | Ref |
|---|---|---|
| **License** | Path 1 — our own loader around the WASM binaries; copy no TeXlyre source | §0 |
| **TeX engine** | Upstream **busytex/busytex** (MIT, TeX Live 2023 + SyncTeX). The TeXlyre TeX Live 2026 build is AGPL — rejected for Path 1. | §0, Phase 0 |
| **Compile role** | Preview-only; never a pipeline artifact; pipeline stays source of truth | §3.1 |
| **Preview download** | None — preview is view-only in the editor | §3.1 |
| **Git hosting** | GitHub-backed; git-backend abstraction added up front; self-host deferred | §2.4, I4 |
| **Push credential** | Done — existing Calkit GitHub App installation; only authorship routing remains | §2.2 |
| **Onboarding (near-term)** | Google sign-in + email/password signup via invite links (pick password on first sign-in) | §2.3 |
| **GitHub-less users** | Can be **collaborators**, but **cannot own/create projects** until git hosting is decoupled (I4). Owners must have a linked GitHub account. | §2.2, I1 |
| **University SSO** | Deferred | I3 |
| **Sequencing** | I1 + I2 land before/with editor Phase 1; Phase 0 spike runs in parallel | §6 |
| **Phase 3 order** | 3a (real-time collaboration) first, then 3b (sessions-as-branches) | Phase 3 |
| **TeX Live packages** | Upstream server for Phase 0/1; self-hosted cached proxy in Phase 2 | Phase 2 |

**Open verification tasks (not decisions):** confirm BusyTeX + SwiftLaTeX engine `.wasm`
artifact licenses fit Path 1 redistribution before Phase 1 ships.

The near-term critical path: **Phase 0 compile spike (BusyTeX)** in parallel with **I1**
(Google/email signup + GitHub-less authorship) and **I2** (native membership + invite
links), then **editor Phase 1** (single-file edit → preview → auto-commit). The detailed
task breakdown for that work is in §8.

---

## 0. The licensing decision (must resolve before writing code)

This is the single most important gate on the plan.

| Project | License | Implication |
|---|---|---|
| **calkit-cloud** | **MIT** (`LICENSE`) | Permissive; what we ship today |
| **TeXlyre** | **AGPL-3.0** | Network-copyleft. Linking/integrating its code into our hosted web app would arguably obligate us to release Calkit's source under AGPL. |
| **SwiftLaTeX** (engine TeXlyre uses) | main repo **AGPL-3.0**; engine wrapper files dual **EPL-2.0 / GPL-2.0 w/ Classpath exception** | The on-disk `.wasm` engines derive from TeX Live (mostly permissive/LPPL), but SwiftLaTeX's own loader/wrapper code is copyleft. |

**Why this matters:** AGPL-3.0 is incompatible with keeping calkit-cloud MIT if we copy
their source into our bundle — and since **Calkit is itself open source (MIT)**, pulling
AGPL code into the tree would force the whole project (or at least the editor) to relicense.
That reinforces Path 1 below (treat the engine as an arms-length binary dependency, write
our own loader). We have three realistic paths:

1. **Clean-room reuse of the WASM engine binaries only.** Treat the compiled SwiftLaTeX
   (`pdftex`/`xetex`) `.wasm` artifacts as a black-box dependency loaded in a Web Worker,
   and write *our own* thin TypeScript loader/bridge (do **not** copy TeXlyre's React/TS
   source). This is the cleanest separation but still needs the engine's own license
   (EPL-2.0/GPL-2.0-classpath) verified as acceptable for redistribution. **Recommended
   starting assumption**, pending a real license review.
2. **Use a permissively-licensed engine instead.** Evaluate alternatives whose licensing is
   friendlier (e.g. engines distributed under MIT/Apache, or texlive.net-style remote
   compile as a fallback). Trade-off: less mature browser story than SwiftLaTeX/BusyTeX.
3. **Accept AGPL for an isolated, separately-licensed sub-package.** Ship the editor as a
   distinct AGPL module/micro-frontend with its own LICENSE, loaded at runtime. Legally
   fragile for a hosted SaaS; only with counsel sign-off.

> **DECIDED: Path 1.** We write our own loader/bridge around the WASM binaries and copy
> **no** TeXlyre React/TS source.
>
> **Engine license verification — DONE, and it has teeth (2026-06-17):**
> - `texlyre-busytex` (npm, TeX Live **2026**) is **AGPL-3.0-or-later** — does **not** fit
>   Path 1 for an MIT project. Its AGPL covers the TS wrapper + build tooling.
> - Upstream `busytex/busytex` is **MIT** (code/scripts); its published `.wasm`/`.data`
>   binaries carry TeX Live/LPPL (permissive) licenses — Path-1-clean — but bundle TeX Live
>   **2023**, not 2026. (No npm package; GitHub-releases only.)
> - **Implication:** the license-clean engine is **busytex 2023**, not the TeXlyre 2026
>   build. See the revised engine decision below / in the Decisions log.

A second gotcha that rides along with the engine choice: **SwiftLaTeX fetches TeX Live
packages on demand from a remote package server at compile time.** We must either
(a) point at SwiftLaTeX's public package server, (b) host our own package repository, or
(c) bundle a fixed TeX Live subset. For reproducibility and uptime we'll likely want our
own cached package endpoint eventually (see Phase 2, "TeX Live package proxy").

---

## 1. How this fits the existing codebase

Grounded in the current architecture (researched, not assumed):

### Frontend (`frontend/`)
- React 18 + TypeScript + Vite, **Chakra UI** components, **TanStack Router** (file-based)
  + **TanStack Query**, auto-generated OpenAPI client in `src/client/`.
- Publications live at
  `src/routes/_layout/$accountName/$projectName/_layout/publications.tsx` with components in
  `src/components/Publications/` (`PublicationView.tsx`, `NewPublication.tsx`,
  `ImportOverleaf.tsx`, `PdfAnnotator.tsx`).
- Full-screen modal pattern already exists (Chakra `Modal` with `size="full"`); see
  `ArtifactCompareModal.tsx` / `FileViewModal.tsx` for large-modal precedent.
- **No editor/CRDT deps yet** — `codemirror`, `yjs`, `swiftlatex` are all net-new.
- File I/O today goes through the OpenAPI client: `getProjectContents()` (base64 or signed
  URL per file), `putProjectContents()` (multipart upload → backend commits & pushes),
  `postProjectFsBatchOp()` (batch file ops). History via `getProjectHistory()` /
  `getProjectFileHistory()`; refs via `searchProjectRefs()`.

### Backend (`backend/app/`)
- FastAPI + SQLModel + Postgres; **GitPython** for repo ops (`app/git.py`), DVC integration
  in `app/dvc.py`, project/file logic in `app/projects.py` and
  `app/api/routes/projects/core.py`.
- Repos are cloned per-user under `/tmp/{github_username}/{owner}/{project}/repo/`, guarded
  by `FileLock`. `PUT contents` already does: write file → `git add` → `git commit` →
  `git push origin <active_branch>` (max 1 MB/file).
- **Publications** are entries in `calkit.yaml` (`Publication` model in
  `app/models/core.py`): `path`, `title`, `type`, optional DVC `stage`, `storage`
  (`git`/`dvc`/`dvc-zip`), and optional `overleaf` sync config. The PDF is usually a DVC
  output of a pipeline stage; the `.tex`/`.bib` sources are typically git-tracked.
- Branch support is **read-only today**: refs can be listed and read without checkout, the
  working tree always reflects the default branch, and there are **no branch
  create/switch/merge endpoints** yet. This is the main backend gap for the
  session-as-branch phase.
- Permissions: `get_project()` resolves Read < Write < Admin < Owner. Editing requires
  **Write**.

### What we can reuse vs. build
- **Reuse:** Chakra full-screen modal pattern, OpenAPI file endpoints for the auto-commit
  MVP, existing Overleaf sync as a sibling feature, DVC URL resolution for figure assets.
- **Build:** CodeMirror-based editor, WASM compile worker + our loader, virtual filesystem
  bridge (repo files ↔ engine FS), and (later) Yjs collaboration + branch/session backend
  endpoints.

---

## 2. Identity, onboarding & git hosting

An Overleaf-grade editor is only as good as its onboarding. The requirement is: a new user
should be able to **sign up with Google / email / their university SSO, click a share link,
and start editing — with no GitHub account** — and their edits must still land as real
commits in the project's repo. This collides head-on with how Calkit works today, so it's a
first-class part of this plan, not an afterthought.

### 2.1 The starting reality (researched)

Calkit is currently **deeply GitHub-coupled**:

- **Login is GitHub-only** in practice. Email/password infra exists (`UserRegister`/
  `UserCreate`, bcrypt, JWT reset tokens) but `POST /users/signup` is intentionally
  **disabled (501)**. A `google-auth.tsx` callback route already exists on the frontend.
- **Every `Account` requires a non-null `github_name`** (`app/models/core.py`), used to
  derive `github_username`, default repo URLs, and API calls.
- **Every `Project` requires a `git_repo_url` on github.com** (`Project.git_repo_url` is
  non-nullable and validated to github.com; the repo is created via the GitHub API at
  project-creation time).
- **Write access is derived from GitHub**: `UserProjectAccess` is a *cache* of
  `GET /repos/{owner}/{repo}/collaborators/{user}/permission`. There is **no native
  collaborators table, and no invite/share-link mechanism** today.
- **Pushes use the requesting user's own GitHub token** via the credential helper in
  `app/git.py`; a user with no GitHub token gets a 401 and cannot push.

Useful foundations already in place to build on: the multi-provider
`UserExternalCredential` table (GitHub/Zenodo/Overleaf/**Google**), bcrypt password support,
refresh tokens, an `Account` abstraction already separate from `User`, and a native
`UserOrgMembership` table (proof we can do native membership without GitHub).

### 2.2 The key decoupling: two identities in every commit

The conceptual unlock is separating the two identities bundled into a git push today:

1. **Authorship** — the `Author:` on the commit (name + email). Costs nothing, needs **no
   GitHub account**. A browser editor can author commits as any signed-in Calkit user.
2. **Push credential** — write access to the *remote*. This is the only part that needs a
   real token.

Today both come from one person's GitHub token. If we split them, a GitHub-less contributor
can author commits that are **pushed under a project-level credential**.

**DECIDED — and the push side is already built.** Calkit already has a **GitHub App
installation** that supplies push access for users with write permission, so the
project-level push credential exists; we don't need to build it. A short-lived, repo-scoped
installation token pushes the commit while the commit is *authored* by the real contributor.

What remains (in I1/I2) is **not** the credential — it's wiring a **GitHub-less Calkit
identity's authorship** (name + verified email) through that existing App push path, so a
contributor who joined via a share link and has no GitHub token still produces a properly
attributed commit that the App pushes.

### 2.3 Recommended direction: decouple identity, keep GitHub as the git backend (for now)

This delivers the full onboarding requirement **without** taking on the risk of self-hosting
git. Changes, roughly in dependency order:

1. **Turn on real onboarding (the near-term priority).**
   - Make creating a Calkit Cloud account dead simple: **"Sign in with Google"** (callback
     already stubbed) and **plain email/password signup** (infra exists, just re-enable).
   - **Invite-link-driven signup is the primary path:** a project share link lands a new
     user on a signup screen where they either continue with Google or **pick a password on
     first sign-in**, and are dropped straight into the project. This ties §2.3.3's invite
     links to the account-creation flow so onboarding is one continuous motion.
   - **University SSO (SAML/OIDC) is deferred** (see I3) — not needed for the initial goal.
     When we do it, lean toward buying a broker over hand-rolling SAML (§2.5 caveat).
2. **Make `github_name` optional** on `Account`; mint a Calkit account `name` independent of
   GitHub. GitHub becomes *one linkable identity/credential*, not the root of identity.
3. **Native membership + invites.** Add a `ProjectMembership` table (role per user) and a
   `ProjectInvitation` / **shareable join-link** table (token, role, expiry, max-uses).
   Project access resolves from native membership **first**, with GitHub-collaborator sync
   kept as one contributing source. This is what makes "click a link → start editing"
   possible for non-GitHub users.
4. **Push via the existing GitHub App installation** (§2.2 — already built). The editor
   commits with the contributor's authorship and pushes via the App's installation token;
   the only new work is routing a GitHub-less contributor's authorship through that path.
5. **Decouple `git_repo_url` from github.com** behind a small **git-backend abstraction**
   (see §2.4) so we're not hard-wired even while GitHub remains the only backend we ship
   first.

Net effect: a student signs in with Google, opens a share link, edits the `.tex` in the WASM
editor, and their commits push to the project's GitHub repo authored as them — no GitHub
account, no friction.

### 2.4 The bigger bet: self-host git, optionally mirror to GitHub

You raised hosting repos ourselves. It's attractive (truly breaks the GitHub dependence; no
contributor ever needs GitHub) but it's a large, separable bet:

- **How:** `dulwich` is *already a dependency* and can serve git smart-HTTP; alternatively
  run Gitea/Forgejo. Store repos on our infra (object storage + metadata), optional **push
  mirror to GitHub** so GitHub-native users keep their workflow.
- **Costs/risks you flagged are real:** scaling git hosting (packfiles, storage, the
  DVC/large-file interplay), migrating existing github.com-backed projects, ops/on-call
  burden, and spooking users who *want* their work on GitHub.
- **DECIDED:** don't self-host now. Introduce the **git-backend abstraction (§2.3.5) up
  front** so `Project` isn't welded to github.com, ship the **GitHub-backed** implementation
  first, and keep **self-hosted git as a pluggable backend** (I4) we can enable later or
  per-deployment without re-architecting.

### 2.5 Open-source implications

- Calkit being **MIT/open source** reinforces the §0 licensing stance (no AGPL in-tree).
- Cloud-only onboarding features (paid SSO broker, GitHub App credentials, hosted SAML)
  must **degrade gracefully in self-hosted OSS builds** — gate them behind config so a
  community deployment still works with plain email/password (and, ironically, self-hosted
  git is the *most* OSS-friendly backend since it needs no github.com at all).

### 2.6 New identity workstream (phases)

These are largely independent of the editor's compile work but **gate its collaborative
value** — non-GitHub contributors can't meaningfully use the editor until I1–I2 land.

- **I1 — Onboarding & push decoupling:** Google + email signup; `github_name` optional;
  route GitHub-less contributor authorship through the **existing** GitHub App push path.
  *(Enables: non-GitHub user edits → commit authored as them → pushed by the App.)*
- **I2 — Native membership & share links:** `ProjectMembership` + `ProjectInvitation`
  (join links); access checks resolve natively first. *(Enables: "click link → start
  editing.")*
- **I3 — University SSO (deferred):** SAML/OIDC, lean toward a broker. Not required for the
  initial launch; revisit after I1/I2 prove out the Google + email + invite-link flow.
- **I4 — (optional, bigger) Self-hosted git:** git-backend abstraction + dulwich/Gitea
  backend + optional GitHub mirror.

> **Sequencing — DECIDED:** **I1 + I2 land alongside or before editor Phase 1.** The first
> editor release must be usable by GitHub-less contributors (Google/email signup + invite
> links), since that's the audience the whole feature targets. Editor Phase 0 (the compile
> spike) can proceed in parallel with I1/I2, but Phase 1 does not ship without them.

---

## 3. Target architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│  Publications page  ──[Edit]──▶  <LatexEditorModal>  (Chakra size=full) │
│                                                                          │
│   ┌─────────────┬───────────────────────┬──────────────────────────┐    │
│   │  File tree  │   CodeMirror editor    │   PDF preview (pdf.js)    │    │
│   │  (.tex/.bib │   (LaTeX mode, errors) │   + log / SyncTeX jumps   │    │
│   │   figures)  │                        │                          │    │
│   └─────────────┴───────────────────────┴──────────────────────────┘    │
│        │                  │                         ▲                     │
│        │                  ▼                         │                     │
│        │        ┌──────────────────────┐   compiled PDF + log            │
│        │        │  Compile Web Worker  │───────────┘                      │
│        │        │  (SwiftLaTeX WASM +  │                                  │
│        │        │   our TS loader)     │                                  │
│        │        └──────────┬───────────┘                                  │
│        │                   │ reads/writes                                 │
│        ▼                   ▼                                              │
│   ┌──────────────────────────────────────┐                               │
│   │  Virtual FS (in-memory / IndexedDB)   │  ◀── seeded from repo         │
│   └──────────────────────────────────────┘      via getProjectContents   │
│                     │                                                     │
│                     ▼  save (debounced / on close)                       │
│   OpenAPI client ── putProjectContents / fsBatchOp ──▶ backend           │
│                     backend: git add/commit/push (auto-commit MVP)       │
└───────────────────────────────────────────────────────────────────────┘
```

Three layers, each independently testable:

1. **Editor UI** — modal, file tree, CodeMirror, PDF preview. Pure frontend.
2. **Compile core** — Web Worker hosting the WASM engine + a virtual filesystem. No
   network at compile time except the TeX Live package fetch.
3. **Persistence** — virtual FS ⇄ project repo. MVP = per-file auto-commit through existing
   endpoints; later = session branch + squash.

### 3.1 Compilation is preview-only — provenance lives in the pipeline

A load-bearing principle for the whole feature: **the WASM compile exists to support editing
the writing, not to produce artifacts.** A PDF compiled in the browser is a disposable
preview, **never a valid pipeline output**, and carries no provenance.

- **Source of truth stays the pipeline.** The official, citable PDF is produced by the
  project's DVC/pipeline stage and cached as it is today. The editor never writes a PDF into
  the repo, DVC, or object storage, and never updates a publication's canonical artifact.
- **Preview PDFs are ephemeral.** They live in the browser (worker memory / IndexedDB cache)
  for the editing session and are thrown away. Nothing server-side persists them.
- **No download (DECIDED).** The draft preview is **view-only in the editor** — no download
  button. This is the strongest guard against a dirty working copy masquerading as "the
  paper." Users who need a file run the pipeline, which produces the official, provenance-
  tracked artifact. (Revisit only if there's real demand; if ever added, it would be a
  clearly-labeled, commit-named "dirty" file.)
- **UI framing.** The editor surfaces the preview as a "draft preview," visually distinct
  from the published artifact shown on the publications page. Regenerating the *official*
  PDF remains a pipeline run, never an editor action.

**Future step (out of scope here): provenance-perfect builds with user compute.** Eventually
we may let a user attach their own compute to a Calkit project and run the real build there
via `calkit`, so an "official" compile is reproducible and fully tracked — the pipeline
produces and caches it, exactly as the canonical path does now. That would be the *only*
sanctioned way to promote a compiled PDF to a real artifact; the in-browser WASM path stays
preview-only regardless.

---

## 4. Phased delivery

### Phase 0 — Spike & decisions (no production code)
- Resolve the **licensing path** (§0) — blocker for everything else.
- Stand up a throwaway spike: load the **upstream MIT busytex** WASM (TeX Live 2023, SyncTeX
  support) in a Web Worker, compile a hello-world `.tex` to PDF entirely in the browser,
  render with pdf.js. Confirm bundle size, cold-start time, and where TeX Live packages come
  from. (Engine license already verified — §0: MIT busytex is Path-1-clean; the TeXlyre 2026
  build is AGPL and rejected.)
- Decide editor lib (**CodeMirror 6** recommended — it's what TeXlyre uses, lighter than
  Monaco, good LaTeX support, and the same core we'd need for Yjs later via `y-codemirror`).
- **Exit criteria:** a documented yes/no on engine + license, and a measured compile of a
  real publication `.tex` from one of our projects.

### Phase 1 — Single-user editor MVP (auto-commit)
Scope: one publication, its primary `.tex`, edit + compile + preview + save.

**Frontend**
- `Edit` button on the publications page (gated on Write permission) opens
  `LatexEditorModal` (Chakra `Modal size="full"`, closable, with unsaved-changes guard).
- `LatexEditor` component: CodeMirror (LaTeX syntax + error squiggles) | PDF preview pane.
- On open: fetch the publication's source file(s) via `getProjectContents()` into the
  virtual FS. Initially handle the single `.tex` and any sibling `.bib`.
- "Compile" (manual + debounced auto) posts the FS to the compile worker, renders the
  returned PDF, surfaces the log/errors in a collapsible panel.
- "Save": write changed files back via `putProjectContents()` (per-file). Auto-commit on
  the backend gives us versioning for free. Debounce + save-on-close.

**Backend**
- Likely **no new endpoints** for the MVP — reuse `PUT contents`. Possible small additions:
  raise/relax the 1 MB limit awareness for `.tex`, and confirm `getProjectContents` returns
  raw text suitably for editing.

**Out of scope for Phase 1:** multi-file projects with `\input`, DVC figures, collaboration,
branches.

**Exit criteria:** edit a real paper's `.tex`, compile to PDF in-browser, save, and see the
auto-commit land on the default branch with a push to GitHub.

### Phase 2 — Real projects: multi-file, figures, bib, SyncTeX
- **Virtual FS seeding for a whole publication directory**: resolve all dependencies
  (`\input`/`\include`, `\bibliography`, `\includegraphics`). Pull git-tracked sources as
  text and **DVC/large binary figures via their signed URLs** (`getProjectContents` already
  returns `url` for DVC-stored files; figures may be pipeline outputs).
- **File tree** panel (read + edit text files; figures shown read-only).
- **bibtex/biber + multi-pass** compile orchestration in the worker.
- **SyncTeX** forward/inverse search (click PDF ↔ jump to source) — BusyTeX build supports
  SyncTeX; factor into engine choice.
- **TeX Live package proxy** (optional but recommended): a backend route that caches the
  packages the engine requests, so compiles are reproducible and don't depend on a
  third-party package server.
- **Batch save** via `postProjectFsBatchOp()` to commit multiple changed files in one
  commit instead of N.

**Exit criteria:** a multi-file paper with figures and a `.bib` compiles to the same PDF
the pipeline produces (or close enough), with figures resolved.

### Phase 3 — Collaboration and/or editing sessions

Two related but separable upgrades. **Decided order: 3a (real-time collaboration) first**,
then 3b (sessions-as-branches) — collaboration delivers the headline Overleaf feel soonest
and reuses the Phase 1 auto-commit model unchanged.

**3a. Real-time collaboration (Yjs)**
- Add `yjs` + `y-codemirror.next`. Shared doc, live cursors/selections.
- Needs a sync transport: a **WebSocket relay** (`y-websocket`, server-authoritative — fits
  our hosted model better than TeXlyre's P2P WebRTC) or WebRTC w/ a signaling server.
  Server-authoritative is the recommended fit for Calkit since we already have a backend.
- Presence/awareness UI in Chakra. Persistence of the live doc (Redis/Postgres or a doc
  service) is the main new infra.

**3b. Editing sessions = branches (squash on finish)**
This is the bigger backend lift because branch *writes* don't exist yet.
- New backend capability in `app/git.py` / projects routes:
  - Start session → create branch `editor-session/<id>` from default, check it out in the
    per-user repo clone.
  - Commit edits to the session branch (auto-commit, frequent, cheap).
  - Finish session → **squash-merge** the branch into the default branch as a single,
    well-described commit; delete the session branch. Handle conflicts/abort.
  - Discard session → delete branch, no merge.
- Data model: a `EditingSession` (or reuse `FileLock`-style table) tracking branch name,
  owner, publication path, status, base commit.
- Frontend: session lifecycle UI (start/resume/finish/discard), "draft" vs "published"
  state, and a diff/review of the squash before it merges (we already have
  `ArtifactCompareModal` + `react-diff-viewer` to lean on).
- Interaction with the current "working tree = default branch" assumption and the per-user
  `/tmp` clone model needs care — concurrent sessions and the existing `PUT contents`
  auto-commit path must not stomp each other.

**Exit criteria (3b):** start a session, make several edits/compiles, finish → exactly one
clean commit on the default branch; discard → no trace.

---

## 5. Key technical risks & open questions

1. **License (§0)** — gating. Resolve first.
2. **TeX Live package delivery** — on-demand fetch vs. self-hosted proxy vs. bundled subset.
   Affects reproducibility, offline, and cold-start latency.
3. **Bundle size / cold start** — WASM engines are large (tens of MB). Lazy-load the worker
   only when the editor opens; cache aggressively (IndexedDB / service worker).
4. **Figure & big-file handling** — DVC outputs are large and may be pipeline-generated.
   Pull read-only via signed URLs; don't try to round-trip them through the editor.
5. **Fidelity vs. the pipeline build** — in-browser compile may differ from the project's
   canonical (Docker/DVC stage) build. This is acceptable *because* the WASM compile is
   preview-only and the pipeline stays source of truth (see §3.1) — but the UI must make the
   draft-vs-published distinction obvious so the difference never causes confusion.
6. **Branch-write model (Phase 3b)** — net-new backend surface; concurrency with the
   existing per-user clone + auto-commit path is the trickiest part.
7. **Concurrent edits before Yjs** — Phase 1/2 are single-writer; reuse `FileLock` to avoid
   two users (or the editor + Overleaf sync) clobbering each other.
8. **Relationship to existing Overleaf import/sync** — is this editor a *replacement* for
   that flow, or complementary? Affects whether we keep `ImportOverleaf` prominent.
9. **Identity decoupling (§2)** — making `github_name` optional and resolving access from a
   native membership table touches core auth; risk of regressing existing GitHub-derived
   permissions. Needs careful migration + keeping GitHub-collaborator sync working.
10. **Push attribution & abuse** — pushing GitHub-less contributors' commits under a GitHub
    App token means commit *authorship* is only as trustworthy as our auth; verify emails,
    and rate-limit/scope join-link roles to avoid a share link becoming a write-access leak.
11. **SSO build-vs-buy & OSS degradation (§2.5)** — a paid SSO broker is the pragmatic path
    for university IdPs but must not become a hard dependency for self-hosted OSS builds.

---

## 6. Rough sequencing / sizing

Two interleaved tracks — **Editor** (compile/UX) and **Identity** (onboarding/git):

| Phase | Track | Outcome | Relative size |
|---|---|---|---|
| 0 | Editor | License decision + WASM compile spike | Small (but blocking) |
| I1 | Identity | Google + email signup; `github_name` optional; GitHub App push credential | Medium |
| I2 | Identity | Native `ProjectMembership` + shareable join links; native access checks | Medium |
| 1 | Editor | Single-file editor modal, compile, auto-commit save | Medium |
| 2 | Editor | Multi-file, figures, bib, SyncTeX, batch save, package proxy | Large |
| 3a | Editor | Real-time collaboration (Yjs + WS relay) | Large |
| 3b | Editor | Editing sessions as branches w/ squash-merge | Large (backend-heavy) |
| I3 | Identity | (Deferred) University SSO (SAML/OIDC via broker) | Medium |
| I4 | Identity | (Optional) Self-hosted git backend + GitHub mirror | Large (infra-heavy) |

**Decided ordering:** Editor Phase 0 (compile spike) runs in parallel with **I1 + I2, which
land before/with editor Phase 1** — the first editor release must serve GitHub-less
contributors. Editor phases 1–2 then deliver "edit & preview in the browser, versioned in
git." Editor Phase 3 is where it becomes truly collaborative; 3a and 3b can ship in either
order — **3a (collaboration) first**. I3 (university SSO) and I4 (self-hosted git) are both
deferred.

---

## 7. Proposed first concrete steps

1. Phase 0 spike in a scratch branch: **BusyTeX** WASM in a Web Worker compiling a real
   project `.tex` → PDF in browser; measure & document. (See §8.1 for the full task list.)
2. Add `codemirror`, pdf.js (already partly present via `pdfjs-dist`), and the engine
   artifact to `frontend/`; scaffold `src/components/Publications/LatexEditor/`.
3. Wire the `Edit` button + full-screen modal shell with file-load and save stubs.
4. Land the manual-compile + auto-commit MVP behind a feature flag.

The fully decomposed task breakdown for the near-term critical path (Phase 0 + I1 + I2 +
editor Phase 1) is in **§8**.

---

### Open questions for review
- ~~Licensing path~~ — **DECIDED: Path 1** (§0). Only follow-up: verify the engine `.wasm`
  artifact licenses before Phase 1.
- ~~Engine choice~~ — **DECIDED: upstream MIT `busytex/busytex`** (TeX Live 2023 + SyncTeX).
  License verified Path-1-clean; the TeXlyre TeX Live 2026 build is AGPL and was rejected.
- ~~Git hosting strategy~~ — **DECIDED: GitHub-backed, with the git-backend abstraction
  (§2.4) introduced up front.** Self-hosted git stays a pluggable backend deferred to I4.
- ~~Push credential~~ — **DECIDED/DONE: existing Calkit GitHub App installation** supplies
  push for write-access users (§2.2). Remaining work is authorship routing, not credentials.
- ~~University SSO~~ — **DECIDED: deferred (I3).** Near-term onboarding = Google sign-in +
  email/password signup via invite links (pick password on first sign-in). Broker-vs-build
  revisited when we actually start I3.
- ~~I1+I2 sequencing~~ — **DECIDED: I1 + I2 land before/with editor Phase 1**; Phase 0
  spike runs in parallel.
- ~~Phase 3 priority~~ — **DECIDED: 3a (real-time collaboration) first**, then 3b.
- ~~Preview download~~ — **DECIDED: no download; preview is view-only** (§3.1).
- ~~TeX Live package server~~ — **DECIDED: defer.** Use the upstream/public package server
  for Phase 0/1; self-host a cached package proxy in Phase 2 (§ Phase 2) for reproducibility
  and uptime.

---

## 8. Task breakdown — near-term critical path

Four workstreams. **§8.1 (Phase 0 spike)** can start immediately and run in parallel with
**§8.2 (I1)** and **§8.3 (I2)**; **§8.4 (editor Phase 1)** depends on all three. File paths
are the current locations found during research — verify before editing.

### 8.1 Phase 0 — BusyTeX compile spike (throwaway, scratch branch)

Goal: prove an in-browser compile of a real Calkit paper before committing to UI work.

**STATUS: DONE — verdict GO.** Spike lives in `spikes/latex-wasm-busytex/` (throwaway;
binaries gitignored, re-fetch via `download-assets.sh`). Verified headless in Chrome.

- [x] ~~Obtain artifact + confirm license fits Path 1.~~ **Done (§0):** upstream MIT
      `busytex/busytex` (TeX Live 2023); TeXlyre's 2026 build is AGPL and rejected.
- [x] ~~Page loads engine in a Web Worker, compiles a hello-world `.tex` to PDF, renders it.~~
      Our own loader (`main.js`) around the MIT busytex worker; PDF shown via blob-URL iframe.
- [x] ~~Compile a real-ish `.tex` with packages.~~ article + `amsmath`/`graphicx`/`hyperref`
      → 121.6 KB PDF, `exit_code 0`, all packages resolved from the `texlive-basic` bundle.
      *(Follow-up: try a heavier real paper from an actual project in §8.4.)*
- [x] ~~Measure & document.~~ **Cold-start ~1.5–1.8 s, compile ~0.4 s, total ~1.9–2.2 s.**
      Asset size dominates: `busytex.wasm` ≈ 29 MB + `texlive-basic.data` ≈ 100 MB one-time.
- [ ] FS-seed contract decision (how files reach the worker) — carried into §8.4 (the
      `{path, contents}[]` shape busytex expects maps cleanly onto `getProjectContents`).
- **Exit met:** GO with numbers + a working compile. **Key productionization takeaway:** the
      ~130 MB one-time asset download — not compile speed — is the cost to manage (lazy-load
      when the editor opens; cache in IndexedDB / service worker).

### 8.2 I1 — Onboarding & GitHub-less authorship

Goal: a user can create a Calkit Cloud account without GitHub, and their edits can be
authored as them and pushed via the existing GitHub App.

**Constraint (from Pete):** GitHub-less users may **collaborate** but **cannot own/create
projects** until git hosting is decoupled (I4). Owners must have a linked GitHub account.

**Backend**
- [x] ~~Re-enable signup~~ — `POST /users/signup` now creates an email/password user
      (bcrypt) with no GitHub account. (`app/api/routes/users.py`)
- [x] ~~Make `Account.github_name` nullable + migration.~~ Column nullable
      (`app/models/core.py`); migration `f3a9c1d2b4e6_make_account_github_name_nullable`
      (applies cleanly to head). `create_user` no longer forces a `github_name`; None-safe
      types on `User.github_username` / `UserPublic` / `AccountPublic` and the derived
      comment/file-lock props; **invariant guards** keep `Org.github_name` /
      `Project.owner_github_name` typed `str` (owners/orgs always have one).
- [x] ~~Owner guard.~~ `post_project` returns **403** "A linked GitHub account is required to
      create or own projects" for GitHub-less users. Tests: GitHub-less signup + owner-guard
      added; **full backend suite green (89 passed, 4 skipped)**.
- [ ] Finalize **Google sign-in** on the backend (token exchange + user/account creation),
      pairing with the existing `google-auth.tsx` callback; store identity via
      `UserExternalCredential` (provider=google).
- [ ] **Authorship routing:** when committing on behalf of a GitHub-less user, set git
      `author`/`committer` to the Calkit user's name + **verified** email, while the push
      uses the existing GitHub App installation token (confirm where that token is fetched in
      `app/git.py` and that the commit path in `projects/core.py` PUT-contents can take an
      explicit author). Add email verification if not already enforced. *(Only hit once
      GitHub-less collaborators can reach a project — needs I2; also make the `git.py` temp-
      path / committer-config `github_username` reads None-safe at that point.)*

**Frontend**
- [ ] Login/signup UI (`src/routes/login/`): add "Continue with Google" + email/password
      sign-up alongside the existing GitHub button.
- [ ] Wire the Google callback (`src/routes/google-auth.tsx`) end-to-end through `lib/auth.ts`
      token storage.

- **Exit:** create an account via Google and via email/password (no GitHub); make an edit
  through an existing write path and see a commit authored as the Calkit user, pushed by the
  App.

### 8.3 I2 — Native membership & shareable invite links

Goal: project access resolves from a native table first, and a share link lets a new user
join and start editing.

**Backend**
- [ ] `ProjectMembership` table (user_id, project_id, role) — model + migration in
      `backend/app/models/core.py`. Mirror the role semantics already in `UserOrgMembership`.
- [ ] `ProjectInvitation` table: token (opaque), project_id, role, expiry, max-uses,
      created_by; endpoints to **create**, **list/revoke**, and **redeem** (redeem → create
      `ProjectMembership`, requires an authenticated account from §8.2).
- [ ] Update access resolution in `backend/app/projects.py` (`get_project`, ~lines 80–200):
      check native `ProjectMembership` **first**, fall back to the existing
      GitHub-collaborator `UserProjectAccess` cache. Don't regress GitHub-derived access.
- [ ] Decide invite-link → repo-write mapping: a redeemer with native `write` must be able
      to push via the App even though they're not a GitHub collaborator (ties to §8.2
      authorship routing). Guard against share-link role escalation / leakage (risk §5.10).

**Frontend**
- [ ] "Invite / share" UI on the project (create link, pick role, copy). Reuse Chakra modal
      patterns.
- [ ] Invite landing route: unauthenticated visitor → signup (§8.2) → auto-redeem → land in
      the project.

- **Exit:** a brand-new user clicks a share link, signs up with Google or a password, and
  is dropped into the project with the granted role.

### 8.4 Editor Phase 1 — single-file editor MVP (depends on 8.1–8.3)

Goal: open a publication, edit its `.tex`, compile-preview in-browser, save via auto-commit.

**Frontend**
- [ ] Add deps: `codemirror` (v6) + LaTeX language support; reuse `pdfjs-dist`. Package the
      BusyTeX engine artifact (lazy-loaded only when the editor opens).
- [ ] Scaffold `src/components/Publications/LatexEditor/`: full-screen Chakra `Modal`
      (`size="full"`, closable, unsaved-changes guard) following `ArtifactCompareModal` /
      `FileViewModal` precedent.
- [ ] **Edit** button on the publications page
      (`src/routes/_layout/$accountName/$projectName/_layout/publications.tsx`), gated on
      Write permission.
- [ ] On open: fetch the publication's `.tex` (+ sibling `.bib`) via
      `ProjectsService.getProjectContents()` into the worker's virtual FS.
- [ ] CodeMirror editor pane | PDF preview pane; manual + debounced auto compile through the
      §8.1 worker; collapsible log/error panel. **View-only preview, no download** (§3.1).
- [ ] Save via `putProjectContents()` (per-file) with debounce + save-on-close; auto-commit
      handled by the backend.
- [ ] Feature-flag the whole entry point.

**Backend**
- [ ] Likely no new endpoints — reuse `PUT contents`
      (`backend/app/api/routes/projects/core.py` ~lines 1138–1185). Confirm `.tex` round-trips
      as raw text and re-check the 1 MB file-size limit for typical sources.

- **Exit:** edit a real paper's `.tex`, compile to PDF in-browser, save, and see the
  auto-commit land + push to GitHub — as a non-GitHub user who joined via an invite link.

**All open questions resolved.** Remaining follow-ups are verification tasks, not decisions:
confirm the BusyTeX + SwiftLaTeX engine artifact licenses fit Path 1 before Phase 1 ships.
