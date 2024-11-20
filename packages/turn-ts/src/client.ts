import { randomBytes } from "node:crypto";
import { assert } from "@e5pe0n/lib";
import {
  type AddrFamily,
  UdpAgent,
  type UdpAgentInitConfig,
} from "@e5pe0n/stun-ts";
import type { MsgMethod } from "./method.js";
import { type TurnMsg, decodeTurnMsg, encodeTurnMsg } from "./msg.js";

type ClientConfig = UdpAgentInitConfig & {
  username: string;
  password: string;
  realm: string;
};

export type AllocateSuccessResponse = {
  success: true;
  relayedAddress: {
    family: AddrFamily;
    address: string;
    port: number;
  };
  mappedAddress: {
    family: AddrFamily;
    address: string;
    port: number;
  };
  lifetime: number; // sec
};

export type AllocateErrorResponse = {
  success: false;
  code: number;
  reason: string;
};

export type AllocateResponse = AllocateSuccessResponse | AllocateErrorResponse;

function pResMsg(msg: TurnMsg): AllocateResponse {
  const relayedAddrAttr = msg.attrs.find(
    (attr) => attr.type === "XOR-RELAYED-ADDRESS",
  );
  assert(
    !!relayedAddrAttr,
    new Error("invalid response; XOR-RELAYED-ADDRESS attr not found."),
  );
  const mappedAddrAttr = msg.attrs.find(
    (attr) => attr.type === "XOR-MAPPED-ADDRESS",
  );
  assert(
    !!mappedAddrAttr,
    new Error("invalid response; XOR-MAPPED-ADDRESS attr not found."),
  );
  const lifetimeAttr = msg.attrs.find((attr) => attr.type === "LIFETIME");
  assert(
    !!lifetimeAttr,
    new Error("invalid response; LIFETIME attr not found."),
  );
  return {
    success: true,
    relayedAddress: relayedAddrAttr.value,
    mappedAddress: mappedAddrAttr.value,
    lifetime: lifetimeAttr.value,
  };
}

export class Client {
  #agent: UdpAgent;
  #config: ClientConfig;

  constructor(config: ClientConfig) {
    this.#agent = new UdpAgent(config);
    this.#config = config;
  }

  get config() {
    return structuredClone(this.#config);
  }

  close(): void {
    this.#agent.close();
  }

  async request(method: MsgMethod): Promise<AllocateResponse> {
    const trxId = randomBytes(12);
    switch (method) {
      case "Allocate": {
        const reqMsg1 = encodeTurnMsg({
          header: {
            cls: "Request",
            method: "Allocate",
            trxId,
          },
          attrs: [
            {
              type: "SOFTWARE",
              value: "@e5pe0n/turn-ts@0.0.1 client",
            },
            {
              type: "LIFETIME",
              value: 3600,
            },
            {
              type: "REQUESTED-TRANSPORT",
              value: 17,
            },
            {
              type: "DONT-FRAGMENT",
            },
          ],
        });
        const resMsg1 = await this.#agent.request(reqMsg1);
        const res1 = decodeTurnMsg(resMsg1);
        const errCodeAttr1 = res1.attrs.find(
          (attr) => attr.type === "ERROR-CODE",
        );
        assert(
          !!errCodeAttr1,
          new Error("invalid response; ERROR-CODE attr not found."),
        );
        assert(
          errCodeAttr1!.value.code === 401,
          new Error(
            `invalid response; expected ERROR-CODE code is 401. actual is ${errCodeAttr1!.value.code}`,
          ),
        );
        const realmAttr = res1.attrs.find((attr) => attr.type === "REALM");
        assert(
          !!realmAttr,
          new Error("invalid response; REALM attr not found."),
        );
        const nonceAttr = res1.attrs.find((attr) => attr.type === "NONCE");
        assert(
          !!nonceAttr,
          new Error("invalid response; NONCE attr not found."),
        );
        const reqMsg2 = encodeTurnMsg({
          header: {
            cls: "Request",
            method: "Allocate",
            trxId,
          },
          attrs: [
            {
              type: "SOFTWARE",
              value: "@e5pe0n/turn-ts@0.0.1 client",
            },
            {
              type: "LIFETIME",
              value: 3600,
            },
            {
              type: "REQUESTED-TRANSPORT",
              value: 17,
            },
            {
              type: "DONT-FRAGMENT",
            },
            {
              type: "USERNAME",
              value: this.#config.username,
            },
            {
              type: "REALM",
              value: realmAttr!.value,
            },
            {
              type: "NONCE",
              value: nonceAttr!.value,
            },
            {
              type: "MESSAGE-INTEGRITY",
              params: {
                term: "long",
                username: this.#config.username,
                password: this.#config.password,
                realm: realmAttr!.value,
              },
            },
          ],
        });
        const resMsg2 = await this.#agent.request(reqMsg2);
        const res2 = decodeTurnMsg(resMsg2);
        const errCodeAttr2 = res2.attrs.find(
          (attr) => attr.type === "ERROR-CODE",
        );
        if (errCodeAttr2) {
          return {
            success: false,
            code: errCodeAttr2.value.code,
            reason: errCodeAttr2.value.reason,
          };
        }
        const relayedAddrAttr = res2.attrs.find(
          (attr) => attr.type === "XOR-RELAYED-ADDRESS",
        );
        assert(
          !!relayedAddrAttr,
          new Error("invalid response; XOR-RELAYED-ADDRESS attr not found."),
        );
        const mappedAddrAttr = res2.attrs.find(
          (attr) => attr.type === "XOR-MAPPED-ADDRESS",
        );
        assert(
          !!mappedAddrAttr,
          new Error("invalid response; XOR-MAPPED-ADDRESS attr not found."),
        );
        const lifetimeAttr = res2.attrs.find(
          (attr) => attr.type === "LIFETIME",
        );
        assert(
          !!lifetimeAttr,
          new Error("invalid response; LIFETIME attr not found."),
        );
        return {
          success: true,
          relayedAddress: relayedAddrAttr!.value,
          mappedAddress: mappedAddrAttr!.value,
          lifetime: lifetimeAttr!.value,
        };
      }
      default:
        throw new Error(`invalid method: ${method}`);
    }
  }
}
