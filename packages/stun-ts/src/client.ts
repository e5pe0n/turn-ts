import { randomBytes } from "node:crypto";
import { createAgent, type Agent, type CreateAgentParams } from "./agent.js";
import { StunMsg } from "./msg.js";

export type ClientConfig = CreateAgentParams;

export class Client {
  #agent: Agent;

  constructor(config: ClientConfig) {
    this.#agent = createAgent(config);
  }

  close(): void {
    this.#agent.close();
  }

  async indicate(): Promise<undefined> {
    const trxId = randomBytes(12);
    const msg = StunMsg.build({
      header: {
        cls: "indication",
        method: "binding",
        trxId,
      },
    });
    await this.#agent.indicate(msg.raw);
  }

  async request(): Promise<StunMsg> {
    const trxId = randomBytes(12);
    const msg = StunMsg.build({
      header: {
        cls: "request",
        method: "binding",
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
