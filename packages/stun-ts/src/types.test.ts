import { describe, expectTypeOf, it } from "vitest";
import type { Brand } from "./types.js";

describe("Brand", () => {
  it("makes types nominal", () => {
    type RawStunMsg = Brand<Buffer, "StunMsg">;
    expectTypeOf<RawStunMsg>().toEqualTypeOf<Brand<Buffer, "StunMsg">>();
    expectTypeOf<RawStunMsg>().not.toEqualTypeOf<Brand<Buffer, "stun-msg">>();
    expectTypeOf<RawStunMsg>().not.toEqualTypeOf<Buffer>();
  });
});
