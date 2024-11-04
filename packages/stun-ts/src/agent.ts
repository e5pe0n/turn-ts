import { magicCookie } from "./consts.js";
import { readMagicCookie } from "./header.js";
import { assert } from "./helpers.js";
import type { RawStunMsg } from "./types.js";

export function assertStunMSg(msg: Buffer): asserts msg is RawStunMsg {
  assert(
    msg.length >= 20,
    new Error(
      `invalid stun msg; expected msg length is >= 20 bytes. actual length is ${msg.length}.`,
    ),
  );
  assert(
    msg.length % 4 === 0,
    new Error(
      `invalid stun msg; expected msg length is a multiple of 4 bytes. actual length is ${msg.length}.`,
    ),
  );
  const fstBits = msg[0]! >>> 6;
  assert(
    fstBits === 0,
    new Error(
      `invalid stun msg; expected the most significant 2 bits is 0b00. actual is ${fstBits.toString(2)}.`,
    ),
  );

  const stunMsg = msg as RawStunMsg;
  const cookie = readMagicCookie(stunMsg);
  assert(
    cookie === magicCookie,
    new Error(
      `invalid stun msg; invalid magic cookie. actual is ${cookie.toString(16)}.`,
    ),
  );
}
