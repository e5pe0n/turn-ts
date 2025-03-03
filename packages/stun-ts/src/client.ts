import { randomBytes } from "node:crypto";
import {
  type Agent,
  type TcpAgentInitConfig,
  UdpAgent,
  type UdpAgentInitConfig,
  createAgent,
} from "./agent.js";
import { decodeStunMsg, encodeStunMsg, StunMsg } from "./msg.js";
import type { Protocol } from "./types.js";

export type ClientInitConfig = {
  agent: Agent;
};

export class Client {
  #agent: Agent;

  constructor(config: ClientInitConfig) {
    this.#agent = config.agent;
  }

  async indicate(): Promise<undefined> {
    const trxId = randomBytes(12);
    const msg = encodeStunMsg({
      header: {
        cls: "Indication",
        method: "Binding",
        trxId,
      },
      attrs: [],
    });
    try {
      await this.#agent.indicate(msg);
    } finally {
      this.#agent.close();
    }
  }

  async request(): Promise<Response> {
    const trxId = randomBytes(12);
    const msg = StunMsg.build({
      header: {
        cls: "Request",
        method: "Binding",
        trxId,
      },
    });
    try {
      const resBuf = await this.#agent.request(msg);
      const resMsg = decodeStunMsg(resBuf);
      if (!trxId.equals(resMsg.#header.trxId)) {
        throw new Error(
          `invalid transaction id; expected: ${trxId}, actual: ${resMsg.#header.trxId}.`,
        );
      }
      const xorMappedAddrAttr = resMsg.#attrs.find(
        (attr) => attr.type === "XOR-MAPPED-ADDRESS",
      );
      if (xorMappedAddrAttr) {
        return {
          success: true,
          ...xorMappedAddrAttr.value,
        } satisfies SuccessResponse;
      }
      const errCodeAttr = resMsg.#attrs.find(
        (attr) => attr.type === "ERROR-CODE",
      );
      if (errCodeAttr) {
        return {
          success: false,
          ...errCodeAttr.value,
        } satisfies ErrorResponse;
      }
      throw new Error(
        "invalid response; neither XOR-MAPPED-ADDRESS nor ERROR-CODE exist",
      );
    } finally {
      this.#agent.close();
    }
  }
}
