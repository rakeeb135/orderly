import { describe, expect, it } from "vitest";
import {
  chatMessageSchema, connectionMessageSchema, loginSchema, mentorProfileSchema,
  parseSkills, registerSchema, sanitizeSearch, slotToIso, validateSlot,
} from "@/lib/validation";

const ok = { fullName: "Alex Perera", email: "Alex@Example.com", password: "Password1", role: "student" };

describe("registerSchema (FR-01.1)", () => {
  it("accepts a valid registration and lowercases the email", () => {
    const r = registerSchema.safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("alex@example.com");
  });
  it("rejects short names", () => expect(registerSchema.safeParse({ ...ok, fullName: "A" }).success).toBe(false));
  it("rejects names over 60 chars", () => expect(registerSchema.safeParse({ ...ok, fullName: "A".repeat(61) }).success).toBe(false));
  it("rejects invalid email", () => expect(registerSchema.safeParse({ ...ok, email: "nope" }).success).toBe(false));
  it("rejects passwords without a number", () => expect(registerSchema.safeParse({ ...ok, password: "Password" }).success).toBe(false));
  it("rejects passwords without a letter", () => expect(registerSchema.safeParse({ ...ok, password: "12345678" }).success).toBe(false));
  it("rejects passwords under 8 chars", () => expect(registerSchema.safeParse({ ...ok, password: "Pass1" }).success).toBe(false));
  it("rejects the admin role on public registration (FR-01.6)", () => expect(registerSchema.safeParse({ ...ok, role: "admin" }).success).toBe(false));
  it("accepts mentor role", () => expect(registerSchema.safeParse({ ...ok, role: "mentor" }).success).toBe(true));
});

describe("loginSchema", () => {
  it("requires email and password", () => {
    expect(loginSchema.safeParse({ email: "", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.lk", password: "x" }).success).toBe(true);
  });
});

describe("connection message (FR-07.1)", () => {
  it("allows empty and 300 chars", () => {
    expect(connectionMessageSchema.safeParse("").success).toBe(true);
    expect(connectionMessageSchema.safeParse("x".repeat(300)).success).toBe(true);
  });
  it("rejects 301 chars", () => expect(connectionMessageSchema.safeParse("x".repeat(301)).success).toBe(false));
});

describe("chat message (FR-09.3)", () => {
  it("rejects empty and whitespace-only", () => {
    expect(chatMessageSchema.safeParse("").success).toBe(false);
    expect(chatMessageSchema.safeParse("   \n ").success).toBe(false);
  });
  it("trims and accepts up to 1000 chars", () => {
    const r = chatMessageSchema.safeParse("  hi  ");
    expect(r.success && r.data).toBe("hi");
    expect(chatMessageSchema.safeParse("x".repeat(1000)).success).toBe(true);
  });
  it("rejects 1001 chars", () => expect(chatMessageSchema.safeParse("x".repeat(1001)).success).toBe(false));
});

describe("mentor profile (FR-03.2)", () => {
  const base = {
    fullName: "Sarah Fernando", headline: "Engineer", jobTitle: "", organisation: "", education: "",
    yearsExperience: "5", categoryId: "11111111-1111-4111-8111-111111111111", skills: ["React"], bio: "", acceptingStudents: true,
  };
  it("accepts a valid profile (coerces years)", () => expect(mentorProfileSchema.safeParse(base).success).toBe(true));
  it("rejects years > 60 and < 0", () => {
    expect(mentorProfileSchema.safeParse({ ...base, yearsExperience: "61" }).success).toBe(false);
    expect(mentorProfileSchema.safeParse({ ...base, yearsExperience: "-1" }).success).toBe(false);
  });
  it("requires headline, a skill and a category", () => {
    expect(mentorProfileSchema.safeParse({ ...base, headline: "" }).success).toBe(false);
    expect(mentorProfileSchema.safeParse({ ...base, skills: [] }).success).toBe(false);
    expect(mentorProfileSchema.safeParse({ ...base, categoryId: "" }).success).toBe(false);
  });
  it("limits skills to 10 and bio to 800", () => {
    expect(mentorProfileSchema.safeParse({ ...base, skills: Array.from({ length: 11 }, (_, i) => `s${i}`) }).success).toBe(false);
    expect(mentorProfileSchema.safeParse({ ...base, bio: "x".repeat(801) }).success).toBe(false);
  });
  it("parseSkills trims, drops blanks and de-duplicates", () => {
    expect(parseSkills(" React, ,Node.js,React ")).toEqual(["React", "Node.js"]);
  });
});

describe("availability slot rules (FR-10.1)", () => {
  const now = new Date("2026-10-09T00:00:00Z");
  it("accepts a valid future 60-minute slot", () => expect(validateSlot("2026-10-12", "10:00", "11:00", now)).toBeNull());
  it("rejects past slots", () => expect(validateSlot("2026-10-01", "10:00", "11:00", now)).toMatch(/future/));
  it("rejects end before start", () => expect(validateSlot("2026-10-12", "11:00", "10:00", now)).toMatch(/after start/));
  it("rejects < 15 and > 120 minutes", () => {
    expect(validateSlot("2026-10-12", "10:00", "10:10", now)).toMatch(/15 and 120/);
    expect(validateSlot("2026-10-12", "10:00", "12:30", now)).toMatch(/15 and 120/);
  });
  it("accepts the 15 and 120 minute boundaries", () => {
    expect(validateSlot("2026-10-12", "10:00", "10:15", now)).toBeNull();
    expect(validateSlot("2026-10-12", "10:00", "12:00", now)).toBeNull();
  });
  it("rejects empty input", () => expect(validateSlot("", "", "", now)).not.toBeNull());
  it("interprets times as Sri Lanka time (+05:30)", () => expect(slotToIso("2026-10-12", "10:00")).toBe("2026-10-12T10:00:00+05:30"));
});

describe("sanitizeSearch (FR-05.1)", () => {
  it("removes filter-breaking characters and trims", () => expect(sanitizeSearch("  re,act(%)  ")).toBe("re act"));
  it("limits to 100 chars", () => expect(sanitizeSearch("a".repeat(150)).length).toBe(100));
  it("returns empty for empty input", () => expect(sanitizeSearch("   ")).toBe(""));
});
