const Brand: unique symbol = Symbol("stun-ts");
type Branded<T extends PropertyKey> = {
  [Brand]: {
    [k in T]: true;
  };
};
export type Brand<T, K extends PropertyKey> = T & Branded<K>;

export type Protocol = "udp" | "tcp";

export type RawStunMsg = Brand<Buffer, "StunMsg">;
