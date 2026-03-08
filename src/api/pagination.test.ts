import { describe, expect, it } from "vitest";
import { parsePaginationQuery } from "./pagination.js";

describe("parsePaginationQuery", () => {
  it("returns defaults when query params are missing", () => {
    const result = parsePaginationQuery(undefined, undefined);
    expect(result).toEqual({
      ok: true,
      value: { limit: 50, offset: 0 },
    });
  });

  it("caps limit at maxLimit", () => {
    const result = parsePaginationQuery("999", "3");
    expect(result).toEqual({
      ok: true,
      value: { limit: 200, offset: 3 },
    });
  });

  it("rejects non-integer limit", () => {
    const result = parsePaginationQuery("1.5", "0");
    expect(result).toEqual({
      ok: false,
      message: '"limit" must be a positive integer.',
    });
  });

  it("rejects negative offset", () => {
    const result = parsePaginationQuery("10", "-1");
    expect(result).toEqual({
      ok: false,
      message: '"offset" must be a non-negative integer.',
    });
  });
});
