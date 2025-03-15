import { assert, fmtArray } from "@e5pe0n/lib";
import { type Listener, createListener } from "./listener.js";
import { StunMsg } from "./msg.js";
import type { Protocol } from "./types.js";
import { logPrefix } from "./common.js";

export type ServerConfig = {
  protocol: Protocol;
};

export class Server {
  #listener: Listener;

  constructor(config: ServerConfig) {
    this.#listener = createListener(config.protocol, (data, rinfo) => {
      const reqMsg = StunMsg.from(data);
      assert(
        ["indication", "request"].includes(reqMsg.header.cls),
        new Error(
          `unexpected message class; expected class is one of ${fmtArray(
            ["indication", "request"],
            (v) => `'${v}'`,
          )}, but actual is '${reqMsg.header.cls}'.`,
        ),
      );
      assert(
        reqMsg.header.method === "binding",
        new Error(
          `unexpected method; expected method is 'binding', but actual is '${reqMsg.header.method}'.`,
        ),
      );

      console.log(
        `${logPrefix} received stun message; ${JSON.stringify(reqMsg)}`,
      );

      const respMsg = StunMsg.build({
        header: {
          cls: "successResponse",
          method: reqMsg.header.method,
          trxId: reqMsg.header.trxId,
        },
        attrs: {
          xorMappedAddress: {
            family: rinfo.family,
            address: rinfo.address,
            port: rinfo.port,
          },
        },
      });

      console.log(
        `${logPrefix} received stun message; ${JSON.stringify(respMsg)}`,
      );

      return respMsg.raw;
    });
  }

  listen(port: number, host?: string) {
    this.#listener.listen(port, host);
    console.log(`${logPrefix} listening on ${host ?? ""}:${port}.`);
  }

  close() {
    this.#listener.close();
    console.log(`${logPrefix} server closed.`);
  }
}
