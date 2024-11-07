import {
  encodeStunMsg,
  TcpAgent,
  type TcpAgentInitConfig,
} from "@e5pe0n/stun-ts";
import type { MsgMethod } from "./method.js";
import { randomBytes } from "node:crypto";

type ClientConfig = TcpAgentInitConfig & {
  username: string;
  password: string;
  realm: string;
};

export class Client {
  #agent: TcpAgent;
  #config: ClientConfig;

  constructor(config: ClientConfig) {
    this.#agent = new TcpAgent(config);
    this.#config = config;
  }

  async request(method: MsgMethod) {
    const trxId = randomBytes(12);
    switch (method) {
      case "Allocate":
        {
          const msg = encodeStunMsg({
            header: {
              cls: "Request",
              method: "Allocate",
              trxId,
            },
            attrs: [],
          });
          this.#agent.request();
        }
        break;
    }
  }
}
