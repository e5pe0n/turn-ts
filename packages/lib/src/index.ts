import { setTimeout } from "node:timers/promises";
import { z } from "zod";

/**
 * Override the property types of `T` by given `U`.
 *
 * @example
 * ```
 * type User = { id: string; name: string; age: number; }
 * type AnotherUser = Override<User, { id: number; age: number? }>
 * // { id: number; name: string; age?: number | undefined }
 * ```
 */
export type Override<T, U extends { [Prop in keyof T]?: unknown }> = {
  [Prop in keyof T as Exclude<Prop, keyof U>]: T[Prop];
} & {
  [Prop in keyof U]: U[Prop];
};

/**
 * Union type of values of given a type `T`.
 */
export type ValueOf<T> = T[keyof T];

type Invertable = Record<PropertyKey, PropertyKey>;

export type Inverse<T extends Invertable> = {
  [K in keyof T as T[K]]: K;
};

export function getKey<T extends Invertable, V extends T[keyof T]>(
  record: T,
  value: V,
): Inverse<T>[V] {
  for (const [k, v] of Object.entries(record)) {
    if (v === value) {
      return k as Inverse<T>[V];
    }
  }
  throw new Error(
    `invalid value: value=${String(value)} not in record=${record}`,
  );
}

/**
 * Crate a new Array such as [0, 1, ..., `stop - 1`].
 *
 * @example
 * ```
 * range(5);  // [0, 1, 2, 3, 4]
 * ```
 */
export function range(stop: number): number[];
/**
 * Create a new Array contains from `start` to `stop`(exclusive) by `step` in order.
 *
 * @example
 * ```
 * range(0, 5, 2);  // [0, 2, 4]
 * range(5, 0, -2); // [5, 3, 1]
 * ```
 */
export function range(start: number, stop: number, step: number): number[];
export function range(start: number, stop?: number, step?: number): number[] {
  // in case overload1, start = stop (the first arg), stop = undefined, step = undefined
  const _start = stop ? start : 0;
  const _stop = stop ?? start;
  const _step = step ?? 1;

  if (_step === 0) {
    throw new RangeError(
      `invalid argument: step must not be 0. step=${_step} given.`,
    );
  }

  const len = Math.ceil((_stop - _start) / _step);
  return len <= 0
    ? []
    : Array.from(new Array(len), (_, i) => _start + i * _step);
}

export function assert(
  exp: boolean | (() => boolean),
  err: Error,
): asserts exp {
  let res: boolean;
  if (typeof exp === "function") {
    res = exp();
  } else {
    res = exp;
  }
  if (!res) {
    throw err;
  }
}

export function isKeyOf<R extends object, K extends keyof R>(
  x: unknown,
  r: R,
): x is K {
  return Object.keys(r).includes(x as string);
}

export function assertKeyOf<R extends object, K extends keyof R>(
  x: unknown,
  r: R,
  err: Error,
): asserts x is K {
  if (!isKeyOf(x, r)) {
    throw err;
  }
}

export function isValueOf<R extends object, V extends R[keyof R]>(
  x: unknown,
  r: R,
): x is V {
  return Object.values(r).includes(x);
}

export function assertValueOf<R extends object, V extends R[keyof R]>(
  x: unknown,
  r: R,
  err: Error,
): asserts x is V {
  if (!isValueOf(x, r)) {
    throw err;
  }
}

export function numToBuf(n: number, length: number): Buffer {
  const resBuf = Buffer.alloc(length);
  let m = n;
  for (let offset = length - 1; offset >= 0; --offset) {
    resBuf.writeUInt8(m & 0xff, offset);
    m >>>= 8;
  }
  return resBuf;
}

export function xorBufs(a: Buffer, b: Buffer): Buffer {
  if (a.length !== b.length) {
    throw new Error(
      `invalid args; two buffers must have the same length. a: ${a.length}, b: ${b.length}`,
    );
  }
  const resBuf = Buffer.alloc(a.length);
  for (let offset = 0; offset < a.length; ++offset) {
    const xor =
      a.subarray(offset, offset + 1).readInt8() ^
      b.subarray(offset, offset + 1).readInt8();
    resBuf.writeInt8(xor, offset);
  }
  return resBuf;
}

export function fBuf(buf: Buffer): string {
  return Array.from(buf.values()).toString();
}

export type Result<T, U = unknown> =
  | {
      success: true;
      value: T;
    }
  | {
      success: false;
      error: U;
    };

class RetryError extends Error {
  lastResult?: unknown;

  constructor(
    message: string,
    options?: (ErrorOptions & { lastResult?: unknown }) | undefined,
  ) {
    super(message, options);
    this.lastResult = options?.lastResult;
  }
}

export async function retry<T>(
  fn: () => Promise<T>,
  {
    retryIf,
    maxAttempts,
    intervalMs,
    attemptTimeoutMs,
    timeoutMs,
  }: {
    retryIf: (res: T) => boolean;
    maxAttempts: number;
    intervalMs: number | ((numAttempts: number) => number);
    attemptTimeoutMs: number | ((numAttempts: number) => number);
    timeoutMs?: number;
  },
): Promise<T> {
  assert(
    maxAttempts > 0,
    new RangeError("invalid argument: maxAttempts must be > 0."),
  );
  let numAttempts = 0;
  let lastResult: T | undefined = undefined;
  const _retry = async (): Promise<T> => {
    while (true) {
      ++numAttempts;
      lastResult = await fn();
      if (!retryIf(lastResult)) {
        return lastResult;
      }
      if (numAttempts >= maxAttempts) {
        throw new RetryError(
          `reached max attempts: tried ${numAttempts} times.`,
          { lastResult },
        );
      }

      const _intervalMs =
        typeof intervalMs === "number" ? intervalMs : intervalMs(numAttempts);
      const _attemptTimeoutMs =
        typeof attemptTimeoutMs === "number"
          ? attemptTimeoutMs
          : attemptTimeoutMs(numAttempts);

      // wait for the next attempt
      const state = await Promise.race([
        setTimeout(_intervalMs, "ready" as const),
        setTimeout(_attemptTimeoutMs, "timeout" as const),
      ]);
      if (state === "timeout") {
        throw new RetryError(`reached timeout: tried ${numAttempts} times.`, {
          lastResult,
        });
      }
    }
  };

  if (typeof timeoutMs === "number") {
    const res = await Promise.race([
      _retry(),
      setTimeout(
        timeoutMs,
        new RetryError(`reached timeout: retried ${numAttempts}.`, {
          lastResult,
        }),
      ),
    ]);
    if (res instanceof RetryError) {
      throw res;
    }
    return res;
  }

  return await _retry();
}

export function pad0s(s: string, digits: number): string {
  return "0".repeat(digits - s.length) + s;
}

export function fAddr(addr: Buffer): string {
  if (addr.length === 4) {
    // ip v4
    return addr.join(".");
  } else if (addr.length === 16) {
    // ip v6
    return Array.from(addr)
      .map((v) => pad0s(v.toString(16), 2))
      .reduce((acc, v, i) => {
        if (i % 2 === 0) {
          acc.push(v);
        } else {
          acc[acc.length - 1] = acc.at(-1) + v;
        }
        return acc;
      }, [] as string[])
      .join(":");
  } else {
    throw new Error(
      `invalid address; expected address length is 4 bytes or 16 bytes. actual is ${addr.length} bytes.`,
    );
  }
}

export function pAddr(addr: string): Buffer {
  const nStrsV6 = addr.split(":");
  if (z.string().ip({ version: "v4" }).safeParse(addr).success) {
    const nStrsV4 = addr.split(".");
    return Buffer.from(nStrsV4.map(Number));
  }
  if (z.string().ip({ version: "v6" }).safeParse(addr).success) {
    const nStrsV6 = addr.split(":");

    // e.g."::ffff:128.0.0.1"
    const isLastIpV4 = z
      .string()
      .ip({ version: "v4" })
      .safeParse(nStrsV6.at(-1)).success;

    const numNs = nStrsV6.filter((v) => v.match(/^[0-9a-f]{1,4}$/i)).length;
    const paddedNs: number[] = [];
    let padded = false;
    for (const nStr of isLastIpV4 ? nStrsV6.slice(0, -1) : nStrsV6) {
      if (nStr === "") {
        if (!padded) {
          for (let i = 0; i < 8 - numNs - Number(isLastIpV4) * 2; ++i) {
            paddedNs.push(0);
          }
          padded = true;
        }
      } else {
        paddedNs.push(Number.parseInt(nStr, 16));
      }
    }
    const buf = Buffer.alloc(16);
    for (const [i, n] of paddedNs.entries()) {
      buf.writeUInt16BE(n, i * 2);
    }
    if (isLastIpV4) {
      const nStrsV4 = nStrsV6.at(-1)!.split(".");
      const nStrsV4Num = nStrsV4.map(Number);
      for (const [i, n] of nStrsV4Num.entries()) {
        buf.writeUInt8(n, 12 + i);
      }
    }
    return buf;
  }

  throw new Error(
    "invalid address; expected ip v4 or ip v6 address such as '127.0.0.1' or '2001:db8:85a3::8a2e:370:7334'.",
  );
}

export type Resolve<T> = (value: T | PromiseLike<T>) => void;
export type Reject = (reason?: unknown) => void;

export function withResolvers<T>() {
  let resolve: Resolve<T>;
  let reject: Reject;
  const promise = new Promise<T>((rs, rj) => {
    resolve = rs;
    reject = rj;
  });
  // @ts-ignore: ts(2454)
  return { promise, resolve, reject };
}

// TODO: enable to generate infinite promises
async function* _genPromise<T>(
  setupResolvers: (
    genResolvers: Generator<
      {
        resolve: Resolve<T>;
        reject: Reject;
      },
      void,
      unknown
    >,
  ) => void,
) {
  const promises = range(64).map(() => withResolvers<T>());
  function* genResolvers() {
    for (const { resolve, reject } of promises) {
      yield { resolve, reject };
    }
  }
  const gen = genResolvers();
  setupResolvers(gen);
  yield undefined as unknown as Awaited<T>;
  for (const { promise } of promises) {
    yield await promise;
  }
}

export function genPromise<T>(
  setupResolvers: (
    genResolvers: Generator<
      {
        resolve: Resolve<T>;
        reject: Reject;
      },
      void,
      unknown
    >,
  ) => void,
) {
  const gen = _genPromise(setupResolvers);
  gen.next();
  return gen;
}
