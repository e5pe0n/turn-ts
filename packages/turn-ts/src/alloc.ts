import {
  type Brand,
  type Override,
  type Result,
  withResolvers,
} from "@e5pe0n/lib";
import type { Protocol, TransportAddress } from "@e5pe0n/stun-ts";
import { type Socket, createSocket } from "node:dgram";
import { handleData } from "./handlers/data.js";

export type AllocationId = Brand<string, "AllocationId">;

export type Allocation = {
  id: AllocationId;
  relayedTransportAddress: TransportAddress;
  clientTransportAddress: TransportAddress;
  serverTransportAddress: TransportAddress;
  transportProtocol: Protocol;
  // TODO: Add authInfo
  // authInfo: {
  //   username: string;
  //   password: string;
  //   realm: string;
  //   nonce: string;
  // };
  timeToExpirySec: number;
  createdAt: Date;
  sock: Socket;
  permissions: string[];
};

type FiveTuple = {
  clientTransportAddress: TransportAddress;
  serverTransportAddress: TransportAddress;
  transportProtocol: Protocol;
};

export const AllocationId = {
  from: (fiveTuple: FiveTuple): AllocationId =>
    `${fiveTuple.clientTransportAddress.address}:${fiveTuple.clientTransportAddress.port}-${fiveTuple.serverTransportAddress.address}:${fiveTuple.serverTransportAddress.port}-${fiveTuple.transportProtocol}` as AllocationId,
};

class AllocationRepo {
  #allocations: Map<AllocationId, Allocation> = new Map();

  list(): Map<AllocationId, Allocation> {
    return this.#allocations;
  }

  insert(alloc: Allocation) {
    this.#allocations.set(alloc.id, alloc);
  }

  get(allocKey: AllocationId): Allocation | undefined {
    return this.#allocations.get(allocKey);
  }

  has(allocKey: AllocationId): boolean {
    return this.#allocations.has(allocKey);
  }
}

type InitAllocation = Override<
  Omit<
    Allocation,
    | "id"
    | "serverTransportAddress"
    | "relayedTransportAddress"
    | "createdAt"
    | "sock"
    | "permissions"
  >,
  {
    timeToExpirySec?: number | undefined;
  }
>;

export class Allocator {
  #allocRepo: AllocationRepo;
  #maxLifetimeSec: number;
  #host: string;
  #serverTransportAddress: TransportAddress;
  #serverSock: Socket;

  constructor({
    maxLifetimeSec,
    host,
    serverTransportAddress,
    serverSock,
  }: {
    maxLifetimeSec: number;
    host: string;
    serverTransportAddress: TransportAddress;
    serverSock: Socket;
  }) {
    this.#allocRepo = new AllocationRepo();
    this.#maxLifetimeSec = maxLifetimeSec;
    this.#host = host;
    this.#serverTransportAddress = serverTransportAddress;
    this.#serverSock = serverSock;
  }

  // TODO: handle other errors
  async allocate(init: InitAllocation): Promise<Result<Allocation>> {
    const allocId = AllocationId.from({
      ...init,
      serverTransportAddress: this.#serverTransportAddress,
    });
    if (this.#allocRepo.has(allocId)) {
      return {
        success: false,
        error: Error(`Allocation(id='${allocId}') already exists.`),
      };
    }
    const sock = await bindSocket(this.#host);
    const alloc: Allocation = {
      ...init,
      id: allocId,
      serverTransportAddress: this.#serverTransportAddress,
      relayedTransportAddress: {
        ...sock.address(),
        address: this.#serverTransportAddress.address,
      } as TransportAddress,
      createdAt: new Date(),
      timeToExpirySec: Math.min(
        init.timeToExpirySec ?? this.#maxLifetimeSec,
        this.#maxLifetimeSec,
      ),
      sock,
      permissions: [],
    };
    this.#allocRepo.insert(alloc);
    sock.on("message", (msg, rinfo) => {
      const _alloc = this.#allocRepo.get(allocId);
      if (!_alloc) {
        sock.close();
        return;
      }
      const res = handleData(msg, {
        alloc: _alloc,
        rinfo,
        sender: (msg, rinfo) => {
          this.#serverSock.send(msg, rinfo.port, rinfo.address);
        },
      });
      if (res.success) {
        // TODO: output log depending on env var or config.
        // biome-ignore lint/suspicious/noConsole: tmp
        console.log("handle data success");
      } else {
        // TODO: output log depending on env var or config.
        // biome-ignore lint/suspicious/noConsole: tmp
        console.log("handle data error:", res.error);
      }
    });
    return {
      success: true,
      value: alloc,
    };
  }

  get({
    clientTransportAddress,
    transportProtocol,
  }: Omit<FiveTuple, "serverTransportAddress">): Allocation | undefined {
    console.log(this.#allocRepo.list());
    return this.#allocRepo.get(
      AllocationId.from({
        clientTransportAddress,
        serverTransportAddress: this.#serverTransportAddress,
        transportProtocol,
      }),
    );
  }

  installPermission(
    allocId: AllocationId,
    peerAddress: TransportAddress,
  ): Result<Allocation> {
    console.log(this.#allocRepo.list());
    const alloc = this.#allocRepo.get(allocId);
    if (!alloc) {
      return {
        success: false,
        error: Error(`Allocation(id='${allocId}') does not exist.`),
      };
    }
    alloc.permissions.push(peerAddress.address);
    return { success: true, value: alloc };
  }
}

async function bindSocket(host: string) {
  const sock = createSocket("udp4");
  const { promise, resolve } = withResolvers<Socket>();
  sock.bind(
    {
      address: host,
    },
    () => {
      resolve(sock);
    },
  );
  return await promise;
}
