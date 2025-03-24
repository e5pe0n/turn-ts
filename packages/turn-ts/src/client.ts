import { randomBytes } from "node:crypto";
import { assert } from "@e5pe0n/lib";
import {
  type AddrFamily,
  type Agent,
  type CreateAgentParams,
  createAgent,
} from "@e5pe0n/stun-ts";
import type { MsgMethod } from "./header.js";
import { TurnMsg } from "./msg.js";

type ClientConfig = CreateAgentParams & {
  username: string;
  password: string;
  realm: string;
};

export class Client {
  #agent: Agent;
  #config: ClientConfig;

  constructor(config: ClientConfig) {
    this.#agent = createAgent(config);
    this.#config = config;
  }

  close(): void {
    this.#agent.close();
  }

  async request(method: MsgMethod): Promise<TurnMsg> {
    const trxId = randomBytes(12);
    switch (method) {
      case "allocate": {
        const reqMsg1 = TurnMsg.build({
          header: {
            cls: "request",
            method: "allocate",
            trxId,
          },
          attrs: {
            software: "@e5pe0n/turn-ts@0.0.1 client",
            lifetime: 3600,
            requestedTransport: "udp",
            dontFragment: true,
          },
        });
        const respBuf = await this.#agent.request(reqMsg1.raw);
        const respMsg = TurnMsg.from(respBuf);
        assert(
          !!respMsg.attrs.errorCode,
          new Error("invalid response; ERROR-CODE attr not found."),
        );
        assert(
          respMsg.attrs.errorCode.code === 401,
          new Error(
            `invalid response; expected ERROR-CODE code is 401. actual is ${respMsg.attrs.errorCode.code}.`,
          ),
        );
        assert(
          !!respMsg.attrs.realm,
          new Error("invalid response; REALM attr not found."),
        );
        assert(
          !!respMsg.attrs.nonce,
          new Error("invalid response; NONCE attr not found."),
        );
        const reqMsg2 = TurnMsg.build({
          header: {
            cls: "request",
            method: "allocate",
            trxId,
          },
          attrs: {
            software: "@e5pe0n/turn-ts@0.0.1 client",
            lifetime: 3600,
            requestedTransport: "udp",
            dontFragment: true,
            username: this.#config.username,
            realm: respMsg.attrs.realm,
            nonce: respMsg.attrs.nonce,
            messageIntegrity: {
              term: "long",
              username: this.#config.username,
              password: this.#config.password,
              realm: respMsg.attrs.realm,
            },
          },
        });
        const respBuf2 = await this.#agent.request(reqMsg2.raw);
        const respMsg2 = TurnMsg.from(respBuf2);
        return respMsg2;
      }
      default:
        throw new Error(`invalid method: ${method}`);
    }
  }
}
