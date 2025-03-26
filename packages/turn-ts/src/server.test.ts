import { describe, expect, it } from "vitest";
import { TurnMsg } from "./msg.js";
import { authReq } from "./server.js";
import { magicCookie } from "@e5pe0n/stun-ts";

const ctx: {
  trxId: Buffer;
  username: string;
  realm: string;
  password: string;
  nonce: string;
  serverSideSoftware: string;
  clientSideSoftware: string;
} = {
  trxId: Buffer.from([
    0x81, 0x4c, 0x72, 0x09, 0xa7, 0x68, 0xf9, 0x89, 0xf8, 0x0b, 0x73, 0xbd,
  ]),
  username: "user",
  realm: "example.com",
  password: "pass",
  nonce: "nonce",
  serverSideSoftware: "@e5pe0n/turn-ts@0.0.0 server",
  clientSideSoftware: "@e5pe0n/turn-ts@0.0.0 client",
} as const;

describe("auth req", () => {
  it("returns 401 error response if messageIntegrity is missing", () => {
    const req = TurnMsg.build({
      header: {
        cls: "request",
        method: "allocate",
        trxId: ctx.trxId,
      },
      attrs: {
        requestedTransport: "udp",
      },
    });
    expect(authReq(req, { ...ctx, software: ctx.serverSideSoftware })).toEqual({
      success: false,
      errorResp: {
        header: {
          cls: "errorResponse",
          method: "allocate",
          trxId: req.header.trxId,
          length: expect.any(Number),
          magicCookie,
        },
        attrs: {
          software: ctx.serverSideSoftware,
          errorCode: {
            code: 401,
            reason: "Unauthorized",
          },
          realm: ctx.realm,
          nonce: ctx.nonce,
        },
        raw: expect.any(Buffer),
        msgIntegrityOffset: expect.any(Number),
      },
    } satisfies ReturnType<typeof authReq>);
  });
  it("returns 400 error response if username, realm, or nonce is missing", () => {
    const req = TurnMsg.build({
      header: {
        cls: "request",
        method: "allocate",
        trxId: ctx.trxId,
      },
      attrs: {
        requestedTransport: "udp",
        messageIntegrity: Buffer.alloc(20),
      },
    });
    expect(authReq(req, { ...ctx, software: ctx.serverSideSoftware })).toEqual({
      success: false,
      errorResp: {
        header: {
          cls: "errorResponse",
          method: "allocate",
          trxId: req.header.trxId,
          length: expect.any(Number),
          magicCookie,
        },
        attrs: {
          software: ctx.serverSideSoftware,
          errorCode: {
            code: 400,
            reason: "Bad Request",
          },
        },
        raw: expect.any(Buffer),
        msgIntegrityOffset: expect.any(Number),
      },
    } satisfies ReturnType<typeof authReq>);
  });
  it("returns an error response if username is incorrect", () => {
    const req = TurnMsg.build({
      header: {
        cls: "request",
        method: "allocate",
        trxId: ctx.trxId,
      },
      attrs: {
        requestedTransport: "udp",
        username: "wrong",
        realm: ctx.realm,
        nonce: ctx.nonce,
      },
      password: ctx.password,
    });
    expect(authReq(req, { ...ctx, software: ctx.serverSideSoftware })).toEqual({
      success: false,
      errorResp: {
        header: {
          cls: "errorResponse",
          method: "allocate",
          trxId: req.header.trxId,
          length: expect.any(Number),
          magicCookie,
        },
        attrs: {
          software: ctx.serverSideSoftware,
          errorCode: {
            code: 401,
            reason: "Unauthorized",
          },
          realm: ctx.realm,
          nonce: ctx.nonce,
        },
        raw: expect.any(Buffer),
        msgIntegrityOffset: expect.any(Number),
      },
    } satisfies ReturnType<typeof authReq>);
  });
  it.todo("returns an error response if nonce is incorrect", () => {
    // TODO
  });
  it("returns a success if all checks pass", () => {
    const req = TurnMsg.build({
      header: {
        cls: "request",
        method: "allocate",
        trxId: ctx.trxId,
      },
      attrs: {
        requestedTransport: "udp",
        username: ctx.username,
        realm: ctx.realm,
        nonce: ctx.nonce,
      },
      password: ctx.password,
    });
    expect(authReq(req, { ...ctx, software: ctx.serverSideSoftware })).toEqual({
      success: true,
    } satisfies ReturnType<typeof authReq>);
  });
});
