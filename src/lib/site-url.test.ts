import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveMetadataBase } from "./site-url";

describe("resolveMetadataBase", () => {
  it("prefers an explicit public HTTPS origin", () => {
    const url = resolveMetadataBase({
      explicit: "https://brugapp.example",
      host: "127.0.0.1:4317",
      proto: "http",
      nodeEnv: "production",
    });
    assert.equal(url?.origin, "https://brugapp.example");
  });

  it("ignores an explicit loopback URL in production and uses the public host", () => {
    const url = resolveMetadataBase({
      explicit: "http://127.0.0.1:4317",
      host: "brugapp.fly.dev",
      proto: "https",
      nodeEnv: "production",
    });
    assert.equal(url?.origin, "https://brugapp.fly.dev");
  });

  it("uses the request host on production HTTPS", () => {
    const url = resolveMetadataBase({
      host: "brugapp.example",
      proto: "https",
      nodeEnv: "production",
    });
    assert.equal(url?.href, "https://brugapp.example/");
  });

  it("does not emit loopback as metadataBase in production", () => {
    const url = resolveMetadataBase({
      host: "127.0.0.1:4317",
      proto: "http",
      nodeEnv: "production",
    });
    assert.equal(url, undefined);
  });

  it("allows loopback metadataBase during local development", () => {
    const url = resolveMetadataBase({
      host: "127.0.0.1:4317",
      proto: "http",
      nodeEnv: "development",
    });
    assert.equal(url?.origin, "http://127.0.0.1:4317");
  });

  it("uses Vercel production host when the request host is loopback", () => {
    const url = resolveMetadataBase({
      host: "127.0.0.1:4317",
      proto: "http",
      nodeEnv: "production",
      vercel: "brugapp.vercel.app",
    });
    assert.equal(url?.origin, "https://brugapp.vercel.app");
  });
});
