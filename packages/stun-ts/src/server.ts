import { type Socket, createSocket } from "node:dgram";
import { decodeStunMsg, encodeStunMsg } from "./msg.js";
import type { Protocol } from "./types.js";

export type ServerConfig = {
  protocol: Protocol;
};

export class Server {
  #protocol: Protocol;
  #sock: Socket;

  constructor(config: ServerConfig) {
    this.#protocol = config.protocol;
    this.#sock = createSocket("udp4");
    this.#sock.on("message", (msg, rinfo) => {
      const {
        header: { cls, method, trxId },
        attrs,
      } = decodeStunMsg(msg);
      let res: Buffer;
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
      this.#sock.send(res, rinfo.port, rinfo.address);
    });
  }

  listen(port: number) {
    this.#sock.bind(port);
  }

  close() {
    this.#sock.close();
  }
}
