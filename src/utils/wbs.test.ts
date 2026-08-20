import { describe, it, expect } from "vitest";
import { extractWbs, flattenWbs, parseBulletTree } from "./wbs";

describe("extractWbs", () => {
  it("business mode: MoSCoW col-based table (en) → features with priority, Non-Goals table skipped", () => {
    const prd = `## 1. Executive Summary & Value Proposition
Summary.

## 2. Problem Definition & Market Analysis (TAM/SAM/SOM, Competitors)
Problem.

## 3. Solution Overview & Scope (MoSCoW)
Solution overview.

| Feature | Priority | Description |
|---------|----------|-------------|
| User Authentication | Must-have | Login, register, OTP |
| Payment Processing | Should-have | Midtrans integration |
| AI Recommendations | Could-have | Personalized feed |
| Social Login | Won't-have | Not in v1 |

Non-Goals:

| Item | Alasan Dikeluarkan |
|------|--------------------|
| Multi-language | low priority |

## 4. User Stories & Acceptance Criteria
Stories.`;

    const tree = extractWbs(prd, "business");
    expect(tree.root.children).toHaveLength(4);
    expect(tree.root.children.map((f) => f.title)).toEqual([
      "User Authentication",
      "Payment Processing",
      "AI Recommendations",
      "Social Login",
    ]);
    expect(tree.root.children.map((f) => f.priority)).toEqual([
      "Must-have",
      "Should-have",
      "Could-have",
      "Won't-have",
    ]);
    expect(tree.root.children[0].detail).toContain("User Authentication");
    expect(tree.warnings).toEqual([]);
  });

  it("simple mode: no MoSCoW table → Ch5 FEAT-XX specs with codes + bold-bullet sub-features", () => {
    const prd = `## 1. Problem Statement & Value Proposition
Problem.

## 2. Feature Scope & MVP Definition
Solution approach only, no table here.

## 3. Out of Scope Rules & Boundaries
Out.

## 4. User Stories & Core Workflows
Stories.

## 5. Feature Specification & Logic
### FEAT-01 — User Login
**Tujuan:** Allows users to log in.

**Input Fields:**
| Field | Tipe | Wajib? |
|-------|------|--------|
| Email | text | yes |

**Flow / Alur:**
1. User opens app
2. User enters email

- **Login via Google:** additional OAuth option
- **Remember me:** persist session

### FEAT-02: Register
**Tujuan:** Create account.

- **Phone verification:** SMS OTP flow

## 6. Open Questions, Success Metrics & Timeline
Questions.`;

    const tree = extractWbs(prd, "simple");
    const feats = tree.root.children;
    expect(feats).toHaveLength(2);
    expect(feats[0].code).toBe("FEAT-01");
    expect(feats[0].title).toBe("User Login");
    expect(feats[0].detail).toContain("**Tujuan:**");
    // spec sub-sections filtered, bold bullets kept
    expect(feats[0].children.map((s) => s.title)).toEqual([
      "Login via Google",
      "Remember me",
    ]);
    expect(feats[1].code).toBe("FEAT-02");
    expect(feats[1].title).toBe("Register");
    expect(feats[1].children.map((s) => s.title)).toEqual(["Phone verification"]);
    expect(tree.warnings.some((w) => w.includes("FEAT-XX"))).toBe(true);
  });

  it("technical mode: Strict MoSCoW with category-label rows → items grouped by priority", () => {
    const prd = `## 1. Project Technical Overview & Core Objective
Overview.

## 2. Feature Scope & MVP Definition (Strict MoSCoW)
| Must-have |
|-----------|
| Auth Service |
| Payment API |
| Should-have |
| Admin Panel |

## 3. Data Models & Database Schema
Schema.`;

    const tree = extractWbs(prd, "technical");
    expect(tree.root.children.map((f) => f.title)).toEqual([
      "Auth Service",
      "Payment API",
      "Admin Panel",
    ]);
    expect(tree.root.children.map((f) => f.priority)).toEqual([
      "Must-have",
      "Must-have",
      "Should-have",
    ]);
  });

  it("fallback: no MoSCoW table → any ### heading is a feature, bullets underneath are sub-features", () => {
    const prd = `## 1. Some Chapter
Intro text.

### Checkout Flow
- **Cart review:** show items
- **Payment:** pay with card

### Order Tracking
Just text, no bullets.`;

    const tree = extractWbs(prd);
    const feats = tree.root.children;
    expect(feats).toHaveLength(2);
    expect(feats[0].title).toBe("Checkout Flow");
    expect(feats[0].children.map((s) => s.title)).toEqual(["Cart review", "Payment"]);
    expect(feats[1].title).toBe("Order Tracking");
    expect(feats[1].children).toEqual([]);
    expect(tree.warnings.some((w) => w.includes("using fallback"))).toBe(true);
  });

  it("empty / garbage input never crashes → empty root + warning", () => {
    for (const input of ["", "   \n  ", "not markdown at all"]) {
      const tree = extractWbs(input);
      expect(tree.root.children).toEqual([]);
      expect(tree.warnings.length).toBeGreaterThan(0);
    }
  });

  it("bahasa id: Fitur/Prioritas headers with Harus/Sebaiknya values", () => {
    const prd = `## 1. Ringkasan Eksekutif
Ringkasan.

## 2. Analisis Masalah
Analisis.

## 3. Solusi & Scope (MoSCoW)
| Fitur | Prioritas |
|-------|-----------|
| Login | Harus |
| Laporan Penjualan | Sebaiknya |

## 4. User Stories
Cerita.`;

    const tree = extractWbs(prd, "business");
    expect(tree.root.children.map((f) => f.title)).toEqual(["Login", "Laporan Penjualan"]);
    expect(tree.root.children.map((f) => f.priority)).toEqual(["Must-have", "Should-have"]);
  });

  it("auto-detects mode from chapter count (6 → simple, 12 → business)", () => {
    // 6 chapters → simple mode: no MoSCoW, no FEAT, no ### → falls back with warnings
    const sixChapters = Array.from({ length: 6 }, (_, i) => `## ${i + 1}. Chapter`).join("\n");
    const simpleTree = extractWbs(`${sixChapters}\n\nplain text`);
    expect(simpleTree.warnings.some((w) => w.includes("No features"))).toBe(true);

    // 12 chapters with MoSCoW table in ch3 → business mode parses priorities
    const twelve = Array.from({ length: 12 }, (_, i) => {
      if (i === 2) {
        return `## 3. Solution Overview & Scope (MoSCoW)\n\n| Feature | Priority |\n|---|---|\n| Search | Must-have |`;
      }
      return `## ${i + 1}. Chapter`;
    }).join("\n");
    const businessTree = extractWbs(twelve);
    expect(businessTree.root.children[0]?.title).toBe("Search");
    expect(businessTree.root.children[0]?.priority).toBe("Must-have");
  });

  it("flattenWbs: DFS pre-order", () => {
    const tree = extractWbs(
      `## 1. Chapter
### A
- **A1:** x
- **A2:** y
### B
- **B1:** z`,
      "simple"
    );
    const flat = flattenWbs(tree.root);
    expect(flat.map((n) => n.id)).toEqual([
      "root",
      "f-1",
      "sf-1-1",
      "sf-1-2",
      "f-2",
      "sf-2-1",
    ]);
  });

  // --- W1: contract baru — label kategori di baris terpisah di atas tabel ---
  it("business contract baru (en): `**Must-have**` label line + Feature/Description table (no Priority col) → priority dari label", () => {
    const prd = `## 1. Executive Summary
Summary.

## 2. Problem Definition
Problem.

## 3. Solution Overview & Scope (MoSCoW)
**Must-have**

| Feature | Description |
|---------|-------------|
| User Authentication | Login, register, OTP |
| Payment Processing | Midtrans integration |

**Should-have**

| Feature | Description |
|---------|-------------|
| AI Recommendations | Personalized feed |

## 4. User Stories
Stories.`;

    const tree = extractWbs(prd, "business");
    expect(tree.root.children.map((f) => f.title)).toEqual([
      "User Authentication",
      "Payment Processing",
      "AI Recommendations",
    ]);
    expect(tree.root.children.map((f) => f.priority)).toEqual([
      "Must-have",
      "Must-have",
      "Should-have",
    ]);
  });

  it("technical contract baru: `### Must-have` heading + Feature/Description table → priority dari heading", () => {
    const prd = `## 1. Project Technical Overview
Overview.

## 2. Feature Scope & MVP Definition (Strict MoSCoW)
### Must-have
| Feature | Description |
|---------|-------------|
| Auth Service | IAM, JWT |
### Should-have
| Feature | Description |
|---------|-------------|
| Admin Panel | CRUD users |

## 3. Data Models
Schema.`;

    const tree = extractWbs(prd, "technical");
    expect(tree.root.children.map((f) => f.title)).toEqual(["Auth Service", "Admin Panel"]);
    expect(tree.root.children.map((f) => f.priority)).toEqual(["Must-have", "Should-have"]);
  });

  it("bahasa id contract baru: `**Harus**` label + Fitur/Deskripsi table → Must-have", () => {
    const prd = `## 1. Ringkasan Eksekutif
Ringkasan.

## 3. Solusi & Scope (MoSCoW)
**Harus**

| Fitur | Deskripsi |
|-------|-----------|
| Login | Otentikasi pengguna |

## 4. User Stories
Cerita.`;

    const tree = extractWbs(prd, "business");
    expect(tree.root.children.map((f) => f.title)).toEqual(["Login"]);
    expect(tree.root.children.map((f) => f.priority)).toEqual(["Must-have"]);
  });

  // --- W2: separator titik pada judul FEAT-XX ---
  it("FEAT-XX title formats: dot separator (baru) + legacy separators tetap jalan", () => {
    const prd = `## 1. Chapter
## 2. Chapter
## 3. Chapter
## 4. Chapter
## 5. Feature Specification & Logic
### FEAT-01. Registrasi Pengguna
**Tujuan:** Membuat akun dengan email.

### FEAT-02 — User Login
**Tujuan:** Log in.

### FEAT-03: Register
**Tujuan:** Create account.

### FEAT-04 User Settings
**Tujuan:** Manage profile.

## 6. Chapter`;

    const tree = extractWbs(prd, "simple");
    const feats = tree.root.children;
    expect(feats.map((f) => f.code)).toEqual(["FEAT-01", "FEAT-02", "FEAT-03", "FEAT-04"]);
    expect(feats.map((f) => f.title)).toEqual([
      "Registrasi Pengguna", // dot separator — tidak ada titik bocor
      "User Login", // em-dash
      "Register", // colon
      "User Settings", // spasi (tanpa separator)
    ]);
    expect(feats[0].title.startsWith(".")).toBe(false);
  });

  // --- W3: tabel Non-Goals single-col tidak bocor jadi fitur ---
  it("single-column Non-Goals / Out of Scope tables tidak ter-leak jadi features", () => {
    const prd = `## 1. Executive Summary
Summary.

## 2. Problem
Problem.

## 3. Solution Overview & Scope (MoSCoW)
| Must-have |
|-----------|
| Auth Service |
| Payment API |

| Non-Goals |
|-----------|
| Multi-language |
| Legacy migration |

| Out of Scope |
|--------------|
| On-prem deployment |

## 4. User Stories
Stories.`;

    const tree = extractWbs(prd, "business");
    expect(tree.root.children.map((f) => f.title)).toEqual(["Auth Service", "Payment API"]);
    expect(tree.root.children.map((f) => f.priority)).toEqual(["Must-have", "Must-have"]);
  });

  // --- Strategy 0: hierarchical "Feature Breakdown (WBS)" section ---
  it("strategy 0: business breakdown (EN, module → feature → sub-feature) + MoSCoW priority merge", () => {
    const prd = `## 1. Executive Summary
Summary.

## 2. Problem Definition
Problem.

## 3. Solution Overview & Scope (MoSCoW)
**Must-have**

| Feature | Description |
|---------|-------------|
| User Registration | Signup with email + OTP |
| Payment Processing | Midtrans |

**Should-have**

| Feature | Description |
|---------|-------------|
| AI Recommendations | Feed personalization |

#### Feature Breakdown (WBS)
- **Customer Account**
  - User Registration
    - Email verification
    - OTP resend
  - Profile Management
    - Edit profile
    - Avatar upload
- **Commerce**
  - Payment Processing
    - Midtrans checkout
  - AI Recommendations
    - Personalized feed

## 4. User Stories
Stories.`;

    const tree = extractWbs(prd, "business");
    expect(tree.root.children.map((m) => m.title)).toEqual(["Customer Account", "Commerce"]);
    // module priority = priority terbanyak di children (Must > Should)
    expect(tree.root.children.map((m) => m.priority)).toEqual(["Must-have", "Must-have"]);
    const acct = tree.root.children[0];
    expect(acct.children.map((f) => f.title)).toEqual(["User Registration", "Profile Management"]);
    expect(acct.children.map((f) => f.priority)).toEqual(["Must-have", undefined]);
    const reg = acct.children[0];
    expect(reg.children.map((s) => s.title)).toEqual(["Email verification", "OTP resend"]);
    // detail MoSCoW menang atas detail breakdown
    expect(reg.detail).toContain("Signup with email");
    expect(tree.warnings).toEqual([]);
  });

  it("strategy 0: simple mode ID — `**Modul**` Level-1 + priority dari tabel Fitur/Prioritas", () => {
    const prd = `## 1. Pernyataan Masalah
Masalah.

## 2. Feature Scope & MVP Definition (Cakupan Fitur & Definisi MVP)
| Fitur | Prioritas |
|-------|-----------|
| Login | Harus |
| Registrasi | Sebaiknya |

### Feature Breakdown (WBS)
- **Modul Autentikasi**
  - Login
    - Verifikasi email
  - Registrasi
    - Verifikasi OTP

## 3. Di Luar Lingkup
Luar.

## 4. User Stories
Cerita.

## 5. Spesifikasi Fitur
Spek.

## 6. Pertanyaan Terbuka
Tanya.`;

    const tree = extractWbs(prd, "simple");
    expect(tree.root.children.map((m) => m.title)).toEqual(["Modul Autentikasi"]);
    const modul = tree.root.children[0];
    expect(modul.children.map((f) => f.title)).toEqual(["Login", "Registrasi"]);
    expect(modul.children.map((f) => f.priority)).toEqual(["Must-have", "Should-have"]);
    expect(modul.children[0].children.map((s) => s.title)).toEqual(["Verifikasi email"]);
  });

  it("strategy 0: breakdown tanpa MoSCoW table → fitur tetap keluar, priority undefined", () => {
    const prd = `## 1. Chapter
## 2. Chapter
## 3. Solution Overview & Scope (MoSCoW)
No table here, only prose.

### Feature Breakdown (WBS)
- **Core**
  - Search
  - Filter
- **Social**
  - Feed
    - Comments

## 4. Chapter`;

    const tree = extractWbs(prd, "business");
    expect(tree.root.children.map((f) => f.title)).toEqual(["Core", "Social"]);
    expect(tree.root.children.every((f) => f.priority === undefined)).toBe(true);
    expect(tree.warnings.some((w) => w.includes("MoSCoW table not found"))).toBe(true);
  });

  it("regression: tanpa breakdown → MoSCoW flat tetap dipakai", () => {
    const prd = `## 1. Chapter
## 2. Chapter
## 3. Solution Overview & Scope (MoSCoW)
**Must-have**

| Feature | Description |
|---------|-------------|
| Login | Auth |
| Register | Signup |

## 4. Chapter`;

    const tree = extractWbs(prd, "business");
    expect(tree.root.children.map((f) => f.title)).toEqual(["Login", "Register"]);
    expect(tree.root.children.map((f) => f.priority)).toEqual(["Must-have", "Must-have"]);
    expect(tree.root.children.every((f) => f.children.length === 0)).toBe(true);
    expect(tree.warnings).toEqual([]);
  });

  it("strategy 0: breakdown menang atas Ch5 FEAT-XX specs di simple mode", () => {
    const prd = `## 1. Problem
P.

## 2. Feature Scope & MVP Definition
### Feature Breakdown (WBS)
- **Auth**
  - Login
    - Google OAuth

## 3. Out of Scope
O.

## 4. User Stories
S.

## 5. Feature Specification & Logic
### FEAT-01. Login
**Tujuan:** Log in.

## 6. Open Questions
Q.`;

    const tree = extractWbs(prd, "simple");
    expect(tree.root.children.map((f) => f.title)).toEqual(["Auth"]);
    expect(tree.root.children[0].children.map((f) => f.title)).toEqual(["Login"]);
  });

  it("strategy 0: match title fuzzy (case/karakter) → priority + detail MoSCoW tersalin", () => {
    const prd = `## 1. Chapter
## 2. Chapter
## 3. Solution Overview & Scope (MoSCoW)
**Must-have**

| Feature | Description |
|---------|-------------|
| USER REGISTRATION | Signup with email |

### Feature Breakdown (WBS)
- **Account Module**
  - User-Registration!
    - Email verification

## 4. Chapter`;

    const tree = extractWbs(prd, "business");
    const feat = tree.root.children[0].children[0];
    expect(feat.title).toBe("User-Registration!");
    expect(feat.priority).toBe("Must-have");
    expect(feat.detail).toContain("Signup");
  });
});

describe("parseBulletTree", () => {
  it("parses nested 3-level bullet tree, bold label → title", () => {
    const prd = `
- **Customer Account**
  - User Registration
    - Email verification
    - OTP resend
  - Profile Management
    - Edit profile
- **Commerce**
  - Payment Processing
`;
    const tree = parseBulletTree(prd);
    expect(tree).toHaveLength(2);
    expect(tree.map((m) => m.title)).toEqual(["Customer Account", "Commerce"]);
    expect(tree[0].children.map((f) => f.title)).toEqual(["User Registration", "Profile Management"]);
    const reg = tree[0].children[0];
    expect(reg.children.map((s) => s.title)).toEqual(["Email verification", "OTP resend"]);
    expect(tree[1].children[0].title).toBe("Payment Processing");
    // raw line tersimpan (trimmed) untuk extractWbs (detail subtree)
    expect(reg.raw).toBe("- User Registration");
    expect(reg.children[0].raw).toBe("- Email verification");
  });

  it("tolerates varying indentation (2/4 spaces)", () => {
    const prd = `
- **Modul A**
    - Feat A
        - Sub A
  - Feat B
`;
    const tree = parseBulletTree(prd);
    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe("Modul A");
    expect(tree[0].children.map((f) => f.title)).toEqual(["Feat A", "Feat B"]);
    expect(tree[0].children[0].children.map((s) => s.title)).toEqual(["Sub A"]);
  });

  it("leading indent of all bullets is normalized away (min-offset)", () => {
    const prd = `
    - **X**
        - X1
    - **Y**
`;
    const tree = parseBulletTree(prd);
    expect(tree.map((m) => m.title)).toEqual(["X", "Y"]);
    expect(tree[0].children[0].title).toBe("X1");
  });

  it("ignores non-bullet lines and empty trailing content", () => {
    const prd = `Intro paragraph, not a bullet.
- **Module A**
  - Feat A
Some prose between bullets.
- Module B
no bullet here`;
    const tree = parseBulletTree(prd);
    expect(tree.map((m) => m.title)).toEqual(["Module A", "Module B"]);
    expect(tree[0].children[0].title).toBe("Feat A");
  });

  it("bold with colon separator strips trailing colon from title", () => {
    const tree = parseBulletTree("- **Login:** do auth\n- **Register:** signup");
    expect(tree.map((m) => m.title)).toEqual(["Login", "Register"]);
  });

  it("non-string / empty / bullet-less input → empty array, never throws", () => {
    expect(parseBulletTree("")).toEqual([]);
    expect(parseBulletTree("plain text only")).toEqual([]);
    expect(parseBulletTree(null as unknown as string)).toEqual([]);
  });
});
