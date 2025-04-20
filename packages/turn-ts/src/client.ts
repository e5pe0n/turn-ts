import { randomBytes } from "node:crypto";
import { assert, type Override } from "@e5pe0n/lib";
import {
  type Agent,
  type CreateAgentParams,
  type TransportAddress,
  createAgent,
} from "@e5pe0n/stun-ts";
import { TurnMsg } from "./msg.js";

export type ClientConfig = CreateAgentParams & {
  protocol: "udp";
  username: string;
  password: string;
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
  #realm?: string;
  #nonce?: string;

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

  async requestAllocate(arg?: {
    lifetime?: number;
    dontFragment?: boolean;
  }): Promise<TurnMsg> {
    const { lifetime, dontFragment } = arg ?? {
      lifetime: this.#config.lifetime,
      dontFragment: true,
    };
    const trxId1 = randomBytes(12);
    const reqMsg1 = TurnMsg.build({
      header: {
        cls: "request",
        method: "allocate",
        trxId: trxId1,
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
      respMsg.header.trxId.equals(trxId1),
      new Error("invalid response; trxId is not matched."),
    );
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
    this.#realm = respMsg.attrs.realm;
    this.#nonce = respMsg.attrs.nonce;
    const trxId2 = randomBytes(12);
    const reqMsg2 = TurnMsg.build({
      header: {
        cls: "request",
        method: "allocate",
        trxId: trxId2,
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
    assert(
      respMsg2.header.trxId.equals(trxId2),
      new Error("invalid response; trxId is not matched."),
    );
    return respMsg2;
  }

  async requestCreatePermission({
    xorPeerAddress,
  }: {
    xorPeerAddress: TransportAddress;
  }): Promise<TurnMsg> {
    const trxId = randomBytes(12);
    const reqMsg = TurnMsg.build({
      header: {
        cls: "request",
        method: "createPermission",
        trxId,
      },
      attrs: {
        xorPeerAddress,
        username: this.#config.username,
        realm: this.#realm,
        nonce: this.#nonce,
      },
      password: this.#config.password,
    });
    const respBuf = await this.#agent.request(reqMsg.raw);
    const respMsg = TurnMsg.from(respBuf);
    assert(
      respMsg.header.trxId.equals(trxId),
      new Error("invalid response; trxId is not matched."),
    );
    return respMsg;
  }

  async sendIndication({
    xorPeerAddress,
    data,
  }: { xorPeerAddress: TransportAddress; data: Buffer }): Promise<void> {
    const trxId = randomBytes(12);
    const reqMsg = TurnMsg.build({
      header: {
        cls: "indication",
        method: "send",
        trxId,
      },
      attrs: {
        xorPeerAddress,
        data,
      },
    });
    await this.#agent.indicate(reqMsg.raw);
  }
}
