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

export type UdpClientConfig = Required<UdpClientInitConfig>;

export type TcpClientConfig = Required<TcpClientInitConfig>;

export type ClientInitConfig<P extends Protocol> = {
  protocol: P;
} & (P extends "udp" ? UdpClientInitConfig : TcpClientInitConfig);
export type ClientConfig<P extends Protocol> = {
  protocol: P;
} & (P extends "udp" ? UdpClientConfig : TcpClientConfig);

export class Client<P extends Protocol> {
  #agent: Agent<P>;
  #config: ClientConfig<P>;

  constructor(config: ClientInitConfig<P>) {
    // FIXME: is there a better way to type the class?
    // Type 'UdpAgent' is not assignable to type 'Agent<P>'.
    //   Types of property 'protocol' are incompatible.
    //     Type '"udp"' is not assignable to type 'P'.
    //       '"udp"' is assignable to the constraint of type 'P', but 'P' could be instantiated with a different subtype of constraint 'Protocol'.ts(2322)
    switch (config.protocol) {
      case "udp": {
        const agent: Agent<"udp"> = new UdpAgent(config);
        this.#agent = agent;
        break;
      }
    }
    this.#agent = createAgent(config.protocol, config) as Agent<P>;
    this.#config = { ...config, ...this.#agent.config } as ClientConfig<P>;
  }

  get config(): ClientConfig<P> {
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
