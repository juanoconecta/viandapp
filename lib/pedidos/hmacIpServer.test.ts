import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hmacIpDesdeEnv } from "./hmacIpServer";

describe("hmacIpDesdeEnv", () => {
  beforeEach(() => {
    delete process.env.RATE_LIMIT_SECRET;
  });

  it("falla si falta RATE_LIMIT_SECRET", () => {
    expect(() => hmacIpDesdeEnv("190.190.1.1")).toThrow("RATE_LIMIT_SECRET no configurado.");
  });

  it("calcula el HMAC usando RATE_LIMIT_SECRET", () => {
    process.env.RATE_LIMIT_SECRET = "secreto-a";
    expect(hmacIpDesdeEnv("190.190.1.1")).toBe(
      "e4c5e20dc4d56e8a2f0f871eef32f9a143f1a03f42e11272c5401265180827e9",
    );
  });
});
