import { randomBytes } from "node:crypto";
import type { Agent } from "./agent.js";
import { StunMsg } from "./msg.js";

export type ClientInitConfig = {
  agent: Agent;
};

export class Client {
  #agent: Agent;

  constructor(config: ClientInitConfig) {
    this.#agent = config.agent;
  }

  close(): void {
    this.#agent.close();
  }

  async indicate(): Promise<undefined> {
    const trxId = randomBytes(12);
    const msg = StunMsg.build({
      header: {
        cls: "Indication",
        method: "Binding",
        trxId,
      },
    });
    await this.#agent.indicate(msg.raw);
  }

  async request(): Promise<StunMsg> {
    const trxId = randomBytes(12);
    const msg = StunMsg.build({
      header: {
        cls: "Request",
        method: "Binding",
        trxId,
      },
    });
    const respBuf = await this.#agent.request(msg.raw);
    const respMsg = StunMsg.from(respBuf);
    if (!trxId.equals(respMsg.header.trxId)) {
      throw new Error(
        `invalid transaction id; expected is '${trxId}', but actual is '${respMsg.header.trxId}'.`,
      );
    }
    return respMsg;
  }
}
