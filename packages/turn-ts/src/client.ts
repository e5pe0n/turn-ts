import { assert, type Override } from "@e5pe0n/lib";
import {
  createAgent,
  type Agent,
  type CreateAgentParams,
} from "@e5pe0n/stun-ts";
import { randomBytes } from "node:crypto";
import { TurnMsg } from "./msg.js";

export type ClientConfig = CreateAgentParams & {
  protocol: "udp";
  username: string;
  password: string;
  realm: string;
  software: string;
  lifetime: number;
};

export type InitClientConfig = Override<
  ClientConfig,
  { software?: string; lifetime?: number }
>;

const defaultClientConfig = {
  lifetime: 3600,
  software: "@e5pe0n/turn-ts@0.0.0 client",
};

export class Client {
  #agent: Agent;
  #config: ClientConfig;

  constructor(config: InitClientConfig) {
    this.#agent = createAgent(config);
    this.#config = {
      ...defaultClientConfig,
      ...config,
    };
  }

  close(): void {
    this.#agent.close();
  }

  async requestAllocate({
    lifetime = this.#config.lifetime,
    dontFragment = true,
  }: {
    lifetime?: number;
    dontFragment?: boolean;
  }): Promise<TurnMsg> {
    const trxId = randomBytes(12);
    const reqMsg1 = TurnMsg.build({
      header: {
        cls: "request",
        method: "allocate",
        trxId,
      },
      attrs: {
        software: this.#config.software,
        lifetime: lifetime,
        requestedTransport: "udp",
        dontFragment,
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
        software: this.#config.software,
        lifetime: this.#config.lifetime,
        requestedTransport: "udp",
        dontFragment,
        username: this.#config.username,
        realm: respMsg.attrs.realm,
        nonce: respMsg.attrs.nonce,
      },
      password: this.#config.password,
    });
    const respBuf2 = await this.#agent.request(reqMsg2.raw);
    const respMsg2 = TurnMsg.from(respBuf2);
    return respMsg2;
  }
}
