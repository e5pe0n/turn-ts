import { describe, expect, it } from "vitest";
import {
  type InputLifetimeAttr,
  type InputRequestTransportAttr,
  decodeLifetimeAttrv,
  encodeLifetimeAttrv,
  encodeRequestTransportAttrv,
} from "./attr.js";

describe("encodeRequestTransportAttrv", () => {
  it("encodes REQUESTED-TRANSPORT value", () => {
    const value: InputRequestTransportAttr["value"] = 17;
    const res = encodeRequestTransportAttrv(value);
    expect(res).toEqual(Buffer.from([17, 0, 0, 0]));
  });
});

describe("encodeLifetimeAttrv/decodeLifetimeAttrv", () => {
  it("encodes/decodes LIFETIME value", () => {
    const value: InputLifetimeAttr["value"] = 4_294_967_295;
    const buf = encodeLifetimeAttrv(value);
    const res = decodeLifetimeAttrv(buf);
    expect(res).toBe(value);
  });
});
