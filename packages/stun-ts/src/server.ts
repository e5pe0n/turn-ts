import { type Listener, createListener } from "./listener.js";
import { encodeStunMsg } from "./msg.js";
import type { Protocol, RawStunFmtMsg } from "./types.js";

export type ServerConfig = {
  protocol: Protocol;
};

export class Server {
  #protocol: Protocol;
  #listener: Listener;

  constructor(config: ServerConfig) {
    this.#protocol = config.protocol;
    this.#listener = createListener(this.#protocol, (msg, rinfo) => {
      const {
        header: { method, trxId },
      } = msg;
      let res: RawStunFmtMsg;
      switch (method) {
        case "Binding":
          res = encodeStunMsg({
            header: {
              cls: "SuccessResponse",
              method: "Binding",
              trxId: trxId,
            },
            attrs: [
              {
                type: "XOR-MAPPED-ADDRESS",
                value: {
                  family: rinfo.family,
                  address: rinfo.address,
                  port: rinfo.port,
                },
              },
            ],
          });
          break;
        default:
          throw new Error(`invalid method: ${method} is not supported.`);
      }
      return res;
    });
  }

  listen(port: number, host?: string) {
    this.#listener.listen(port, host);
  }

  close() {
    this.#listener.close();
  }
}
