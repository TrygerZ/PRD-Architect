// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { parseBulletTree } from "../utils/wbs";
import { wbsRows, wbsTableRows } from "./BlueprintSection";

describe("wbsRows", () => {
  it("module → feature → sub (multi sub): satu baris per sub-fitur", () => {
    const items = parseBulletTree(`
- **Customer Account**
  - User Registration
    - Email verification
    - OTP resend
  - Profile Management
    - Avatar upload
- **Commerce**
  - Payment Processing
`);
    expect(wbsRows(items)).toEqual([
      { module: "Customer Account", feature: "User Registration", sub: "Email verification" },
      { module: "Customer Account", feature: "User Registration", sub: "OTP resend" },
      { module: "Customer Account", feature: "Profile Management", sub: "Avatar upload" },
      { module: "Commerce", feature: "Payment Processing", sub: "" },
    ]);
  });

  it("feature tanpa sub → kolom sub kosong", () => {
    const items = parseBulletTree(`
- **Modul A**
  - Login
    - Verifikasi email
  - Registrasi
`);
    expect(wbsRows(items)).toEqual([
      { module: "Modul A", feature: "Login", sub: "Verifikasi email" },
      { module: "Modul A", feature: "Registrasi", sub: "" },
    ]);
  });

  it("breakdown flat tanpa module: module = root, feature = anak (atau root sendiri)", () => {
    const items = parseBulletTree(`
- Login
  - Email login
- Register
`);
    expect(wbsRows(items)).toEqual([
      { module: "Login", feature: "Email login", sub: "" },
      { module: "Register", feature: "Register", sub: "" },
    ]);
  });

  it("empty / bullet-less input → []", () => {
    expect(wbsRows([])).toEqual([]);
    expect(wbsRows(parseBulletTree("plain text"))).toEqual([]);
  });
});

describe("wbsTableRows", () => {
  it("module multi-feature & feature multi-sub: rowSpan benar, sel lain null", () => {
    const rows = wbsRows(parseBulletTree(`
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
`));
    expect(wbsTableRows(rows)).toEqual([
      { module: "Customer Account", moduleSpan: 4, feature: "User Registration", featureSpan: 2, sub: "Email verification" },
      { module: null, feature: null, sub: "OTP resend" },
      { module: null, feature: "Profile Management", featureSpan: 2, sub: "Edit profile" },
      { module: null, feature: null, sub: "Avatar upload" },
      { module: "Commerce", moduleSpan: 1, feature: "Payment Processing", featureSpan: 1, sub: "Midtrans checkout" },
    ]);
  });

  it("feature tanpa sub → featureSpan 1, sub kosong", () => {
    const rows = wbsRows(parseBulletTree(`
- **Modul A**
  - Login
    - Verifikasi email
  - Registrasi
`));
    expect(wbsTableRows(rows)).toEqual([
      { module: "Modul A", moduleSpan: 2, feature: "Login", featureSpan: 1, sub: "Verifikasi email" },
      { module: null, feature: "Registrasi", featureSpan: 1, sub: "" },
    ]);
  });

  it("module sama TIDAK berurutan → bukan satu grup (tidak di-merge)", () => {
    const rows = wbsRows(parseBulletTree(`
- **A**
  - F
- **B**
  - G
- **A**
  - H
`));
    expect(wbsTableRows(rows)).toEqual([
      { module: "A", moduleSpan: 1, feature: "F", featureSpan: 1, sub: "" },
      { module: "B", moduleSpan: 1, feature: "G", featureSpan: 1, sub: "" },
      { module: "A", moduleSpan: 1, feature: "H", featureSpan: 1, sub: "" },
    ]);
  });

  it("empty input → []", () => {
    expect(wbsTableRows([])).toEqual([]);
  });
});