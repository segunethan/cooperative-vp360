import { describe, it, expect } from "vitest";
import {
  nairaToKobo,
  koboToNaira,
  formatMoney,
  formatMoneyFull,
  generatePaymentReference,
} from "../money";

describe("nairaToKobo", () => {
  it("converts whole naira to kobo", () => {
    expect(nairaToKobo(1)).toBe(100);
    expect(nairaToKobo(100)).toBe(10_000);
    expect(nairaToKobo(1_000)).toBe(100_000);
  });

  it("handles fractional naira with correct rounding", () => {
    expect(nairaToKobo(0.5)).toBe(50);
    expect(nairaToKobo(0.01)).toBe(1);
    // Floating point: 0.1 naira = 10 kobo — must not be 9 due to IEEE754
    expect(nairaToKobo(0.1)).toBe(10);
    expect(nairaToKobo(99.99)).toBe(9999);
  });

  it("handles zero", () => {
    expect(nairaToKobo(0)).toBe(0);
  });

  it("handles large cooperative amounts without overflow", () => {
    // ₦10,000,000 — typical cooperative contribution pool
    expect(nairaToKobo(10_000_000)).toBe(1_000_000_000);
  });
});

describe("koboToNaira", () => {
  it("converts kobo to naira", () => {
    expect(koboToNaira(100)).toBe(1);
    expect(koboToNaira(10_000)).toBe(100);
    expect(koboToNaira(50)).toBe(0.5);
  });

  it("handles zero", () => {
    expect(koboToNaira(0)).toBe(0);
  });

  it("is the inverse of nairaToKobo for whole amounts", () => {
    const amounts = [1, 100, 500, 1_000, 50_000, 1_000_000];
    for (const n of amounts) {
      expect(koboToNaira(nairaToKobo(n))).toBe(n);
    }
  });
});

describe("formatMoney", () => {
  it("formats amounts under ₦1,000 as full number", () => {
    expect(formatMoney(0)).toBe("₦0");
    expect(formatMoney(50_000)).toBe("₦500");   // 50,000 kobo = ₦500
    expect(formatMoney(99_900)).toBe("₦999");
  });

  it("formats ₦1,000–₦999,999 as K (thousands)", () => {
    expect(formatMoney(100_000)).toBe("₦1K");       // ₦1,000
    expect(formatMoney(3_800_000)).toBe("₦38K");    // ₦38,000
    expect(formatMoney(99_900_000)).toBe("₦999K");  // ₦999,000
  });

  it("formats ₦1,000,000+ as M (millions)", () => {
    expect(formatMoney(100_000_000)).toBe("₦1.0M");   // ₦1,000,000
    expect(formatMoney(4_520_000_000)).toBe("₦45.2M"); // ₦45,200,000
    expect(formatMoney(12_500_000_000)).toBe("₦125.0M");
  });
});

describe("formatMoneyFull", () => {
  it("formats with naira sign and locale commas", () => {
    expect(formatMoneyFull(0)).toBe("₦0");
    expect(formatMoneyFull(2_500_000)).toBe("₦25,000");
    expect(formatMoneyFull(100_000_000)).toBe("₦1,000,000");
  });
});

describe("generatePaymentReference", () => {
  it("starts with the given prefix", () => {
    const ref = generatePaymentReference("CONTRIB");
    expect(ref).toMatch(/^CONTRIB-\d+-[A-Z0-9]+$/);
  });

  it("generates unique references across repeated calls", () => {
    const refs = Array.from({ length: 50 }, () => generatePaymentReference("TEST"));
    const uniqueSet = new Set(refs);
    expect(uniqueSet.size).toBe(50);
  });

  it("works with different prefixes", () => {
    expect(generatePaymentReference("LOAN")).toMatch(/^LOAN-/);
    expect(generatePaymentReference("DISB")).toMatch(/^DISB-/);
    expect(generatePaymentReference("DIV")).toMatch(/^DIV-/);
  });
});
