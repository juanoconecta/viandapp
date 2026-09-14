import { describe, expect, it } from "vitest";
import { hmacIp } from "./hmacIp";

describe("hmacIp", () => {
  it("produce el vector HMAC SHA-256 literal esperado", () => {
    expect(hmacIp("190.190.1.1", "secreto-a")).toBe(
      "e4c5e20dc4d56e8a2f0f871eef32f9a143f1a03f42e11272c5401265180827e9",
    );
  });

  it("es deterministico para la misma IP y secreto", () => {
    expect(hmacIp("190.190.1.1", "secreto-a")).toBe(hmacIp("190.190.1.1", "secreto-a"));
  });

  it("IPs distintas producen hashes distintos", () => {
    expect(hmacIp("190.190.1.1", "secreto-a")).not.toBe(hmacIp("190.190.1.2", "secreto-a"));
  });

  it("el mismo IP con secretos distintos produce hashes distintos", () => {
    expect(hmacIp("190.190.1.1", "secreto-a")).not.toBe(hmacIp("190.190.1.1", "secreto-b"));
  });

  it("el resultado nunca contiene la IP original", () => {
    expect(hmacIp("190.190.1.1", "secreto-a")).not.toContain("190.190.1.1");
  });
});
