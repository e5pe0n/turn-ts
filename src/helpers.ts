import { setTimeout } from "node:timers/promises";

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
      `invalid args; two buffers must have the same length. a: ${a}, b: ${b}`,
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

export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  intervalMs: number | ((numAttempts: number) => number),
  attemptTimeoutMs: number | ((numAttemps: number) => number),
  timeoutMs?: number,
): Promise<T> {
  const _retry = async (): Promise<Result<T>> => {
    let numAttempts = 0;
    while (true) {
      try {
        ++numAttempts;
        const res = await fn();
        return { success: true, value: res };
      } catch (error) {
        if (numAttempts > maxAttempts) {
          return {
            success: false,
            error: new Error("reached max retries", { cause: error }),
          };
        }
        const _intervalMs =
          typeof intervalMs === "number" ? intervalMs : intervalMs(numAttempts);
        const _attemptTimeoutMs =
          typeof attemptTimeoutMs === "number"
            ? attemptTimeoutMs
            : attemptTimeoutMs(numAttempts);
        const state = await Promise.race([
          setTimeout(_intervalMs, "ready" as const),
          setTimeout(_attemptTimeoutMs, "timeouted" as const),
        ]);
        if (state === "timeouted") {
          return {
            success: false,
            error: new Error("reached timeout"),
          };
        }
      }
    }
  };
  if (typeof timeoutMs === "number") {
    const res = await Promise.race([
      _retry(),
      setTimeout(timeoutMs, {
        success: false,
        error: new Error("reached timeout"),
      } satisfies Result<T>),
    ]);
    if (!res.success) {
      throw res.error;
    }
    return res.value;
  }

  const res = await _retry();
  if (!res.success) {
    throw res.error;
  }
  return res.value;
}
