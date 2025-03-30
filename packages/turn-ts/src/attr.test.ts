import { describe, expect, it } from "vitest";
import {
  decodeChannelNumberValue,
  decodeLifetimeValue,
  decodeRequestedTransportValue,
  encodeChannelNumberValue,
  encodeLifetimeValue,
  encodeRequestedTransportValue,
} from "./attr.js";

describe("CHANNEL-NUMBER", () => {
  describe("encodeChannelNumberValue", () => {
    it("encodes CHANNEL-NUMBER value", () => {
      const res = encodeChannelNumberValue(12345);
      expect(res).toEqual(Buffer.from([0x30, 0x39, 0x00, 0x00]));
    });
  });
  describe("decodeChannelNumberValue", () => {
    it("decodes CHANNEL-NUMBER value", () => {
      const buf = Buffer.from([0x30, 0x39, 0x00, 0x00]);
      const res = decodeChannelNumberValue(buf);
      expect(res).toEqual(12345);
    });
  });
});

describe("LIFETIME", () => {
  describe("encodeLifetimeValue", () => {
    it("encodes LIFETIME value", () => {
      const res = encodeLifetimeValue(3600);
      expect(res).toEqual(Buffer.from([0x00, 0x00, 0x0e, 0x10]));
    });
  });
  describe("decodeLifetimeValue", () => {
    it("decodes LIFETIME value", () => {
      const buf = Buffer.from([0x00, 0x00, 0x0e, 0x10]);
      const res = decodeLifetimeValue(buf);
      expect(res).toEqual(3600);
    });
  });
});

describe("REQUESTED-TRANSPORT", () => {
  describe("encodeRequestedTransportValue", () => {
    it("encodes REQUESTED-TRANSPORT value", () => {
      const res = encodeRequestedTransportValue("udp");
      expect(res).toEqual(Buffer.from([0x11, 0x00, 0x00, 0x00]));
    });
  });
  describe("decodeRequestedTransportValue", () => {
    it("decodes REQUESTED-TRANSPORT value", () => {
      const buf = Buffer.from([0x11, 0x00, 0x00, 0x00]);
      const res = decodeRequestedTransportValue(buf);
      expect(res).toEqual("udp");
    });
  });
});
