import { randomBytes } from "node:crypto";
import {
  TcpAgent,
  type TcpAgentInitConfig,
  UdpAgent,
  type UdpAgentInitConfig,
} from "./agent.js";
import { decodeStunMsg, encodeStunMsg } from "./msg.js";

export type ErrorResponse = {
  success: false;
  code: number;
  reason: string;
};

export type SuccessResponse = {
  success: true;
  family: "IPv4" | "IPv6";
  address: string; // Reflexive Transport Address
  port: number;
};

export type Response = SuccessResponse | ErrorResponse;

export type UdpClientInitConfig = UdpAgentInitConfig & {
  protocol: "udp";
};

export type TcpClientInitConfig = TcpAgentInitConfig & {
  protocol: "tcp";
};

export type ClientInitConfig = UdpClientInitConfig | TcpClientInitConfig;

export type UdpClientConfig = Required<UdpClientInitConfig>;

export type TcpClientConfig = Required<TcpClientInitConfig>;

export type ClientConfig = UdpClientConfig | TcpClientConfig;

export class Client {
  #agent: UdpAgent | TcpAgent;
  #config: ClientConfig;

  constructor(config: ClientInitConfig) {
    switch (config.protocol) {
      case "tcp":
        this.#agent = new TcpAgent(config);
        this.#config = { ...config, ...this.#agent.config };
        break;
      case "udp":
        this.#agent = new UdpAgent(config);
        this.#config = { ...config, ...this.#agent.config };
        break;
    }
  }

  get config(): ClientConfig {
    return structuredClone(this.#config);
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
    await this.#agent.indicate(msg);
  }

  async request(): Promise<Response> {
    const trxId = randomBytes(12);
    const msg = encodeStunMsg({
      header: {
        cls: "Request",
        method: "Binding",
        trxId,
      },
      attrs: [],
    });
    const resBuf = await this.#agent.request(msg);
    const resMsg = decodeStunMsg(resBuf);
    if (!trxId.equals(resMsg.header.trxId)) {
      throw new Error(
        `invalid transaction id; expected: ${trxId}, actual: ${resMsg.header.trxId}.`,
      );
    }
    const xorMappedAddrAttr = resMsg.attrs.find(
      (attr) => attr.type === "XOR-MAPPED-ADDRESS",
    );
    if (xorMappedAddrAttr) {
      return {
        success: true,
        ...xorMappedAddrAttr.value,
      } satisfies SuccessResponse;
    }
    const errCodeAttr = resMsg.attrs.find((attr) => attr.type === "ERROR-CODE");
    if (errCodeAttr) {
      return {
        success: false,
        ...errCodeAttr.value,
      } satisfies ErrorResponse;
    }
    throw new Error(
      "invalid response; neither XOR-MAPPED-ADDRESS nor ERROR-CODE exist",
    );
  }
}
