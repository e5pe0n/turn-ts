import {
  type Brand,
  type Override,
  type Result,
  withResolvers,
} from "@e5pe0n/lib";
import type { Protocol, RemoteInfo, TransportAddress } from "@e5pe0n/stun-ts";
import { type Socket, createSocket } from "node:dgram";
import { TurnMsg } from "./msg.js";

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
  permissions: TransportAddress[];
};

type FiveTuple = {
  clientTransportAddress: TransportAddress;
  serverTransportAddress: TransportAddress;
  transportProtocol: Protocol;
};

function hashFiveTuple(fiveTuple: FiveTuple): AllocationId {
  return `${fiveTuple.clientTransportAddress.address}:${fiveTuple.clientTransportAddress.port}-${fiveTuple.serverTransportAddress.address}:${fiveTuple.serverTransportAddress.port}-${fiveTuple.transportProtocol}` as AllocationId;
}

class AllocationRepo {
  #allocations: Map<AllocationId, Allocation> = new Map();

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

export class AllocationManager {
  #allocRepo: AllocationRepo;
  #maxLifetimeSec: number;
  #host: string;
  #serverTransportAddress: TransportAddress;

  constructor({
    maxLifetimeSec,
    host,
    serverTransportAddress,
  }: {
    maxLifetimeSec: number;
    host: string;
    serverTransportAddress: TransportAddress;
  }) {
    this.#allocRepo = new AllocationRepo();
    this.#maxLifetimeSec = maxLifetimeSec;
    this.#host = host;
    this.#serverTransportAddress = serverTransportAddress;
  }

  // TODO: handle other errors
  async allocate(init: InitAllocation): Promise<Result<Allocation>> {
    const allocId = hashFiveTuple({
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
      relayedTransportAddress: sock.address() as TransportAddress,
      createdAt: new Date(),
      timeToExpirySec: Math.min(
        init.timeToExpirySec ?? this.#maxLifetimeSec,
        this.#maxLifetimeSec,
      ),
      sock,
      permissions: [],
    };
    this.#allocRepo.insert(alloc);
    return {
      success: true,
      value: alloc,
    };
  }

  get({
    clientTransportAddress,
    transportProtocol,
  }: Omit<FiveTuple, "serverTransportAddress">): Allocation | undefined {
    return this.#allocRepo.get(
      hashFiveTuple({
        clientTransportAddress,
        serverTransportAddress: this.#serverTransportAddress,
        transportProtocol,
      }),
    );
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

// https://datatracker.ietf.org/doc/html/rfc5766#section-6.2
export async function handleAllocReq(
  req: TurnMsg,
  {
    allocManager,
    rinfo,
    transportProtocol,
    serverInfo,
  }: {
    allocManager: AllocationManager;
    rinfo: RemoteInfo;
    transportProtocol: Protocol;
    serverInfo: {
      software: string;
    };
  },
): Promise<TurnMsg> {
  if (!(req.header.cls === "request" && req.header.method === "allocate")) {
    return TurnMsg.build({
      header: {
        cls: "errorResponse",
        method: req.header.method,
        trxId: req.header.trxId,
      },
      attrs: {
        errorCode: { code: 400, reason: "Bad Request" },
      },
    });
  }

  if (!req.attrs.requestedTransport) {
    return TurnMsg.build({
      header: {
        cls: "errorResponse",
        method: req.header.method,
        trxId: req.header.trxId,
      },
      attrs: {
        errorCode: { code: 400, reason: "Bad Request" },
      },
    });
  }

  // TODO: move this to where TurnMsg.from() is called
  if (req.attrs.requestedTransport !== "udp") {
    return TurnMsg.build({
      header: {
        cls: "errorResponse",
        method: req.header.method,
        trxId: req.header.trxId,
      },
      attrs: {
        errorCode: { code: 442, reason: "Unsupported Transport Protocol" },
      },
    });
  }

  const res = await allocManager.allocate({
    clientTransportAddress: rinfo,
    transportProtocol,
    timeToExpirySec: req.attrs.lifetime,
  });
  // TODO: handle other errors
  if (!res.success) {
    return TurnMsg.build({
      header: {
        cls: "errorResponse",
        method: req.header.method,
        trxId: req.header.trxId,
      },
      attrs: {
        errorCode: { code: 437, reason: "Allocation Mismatch" },
      },
    });
  }

  return TurnMsg.build({
    header: {
      cls: "successResponse",
      method: "allocate",
      trxId: req.header.trxId,
    },
    attrs: {
      lifetime: res.value.timeToExpirySec,
      software: serverInfo.software,
    },
  });
}
