import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import { RawStunMsgBuilder } from "./msg-builder.js";
import type { RawStunMsg } from "./types.js";

export const credentialsSchema = z.discriminatedUnion("term", [
  z.object({
    term: z.literal("long"),
    username: z.string(),
    realm: z.string(),
    password: z.string(),
  }),
  z.object({
    term: z.literal("short"),
    password: z.string(),
  }),
]);

type Credentials = z.infer<typeof credentialsSchema>;

function calcMessageIntegrity({
  credentials,
  raw,
}: {
  credentials: Credentials;
  raw: RawStunMsg;
}): Buffer {
  let key: Buffer;
  const md5 = createHash("md5");
  switch (credentials.term) {
    case "long": {
      const { username, realm, password } = credentials;
      key = md5.update(`${username}:${realm}:${password}`).digest();
      break;
    }
    case "short": {
      const { password } = credentials;
      key = md5.update(password).digest();
      break;
    }
  }
  const hmac = createHmac("sha1", key);
  hmac.update(raw);
  return hmac.digest();
}

const MESSAGE_INTEGRITY_BYTES = 20;

export function encodeMessageIntegrityValue({
  credentials,
  raw,
}: {
  credentials: Credentials;
  raw: RawStunMsg;
}): Buffer {
  const rawMsgBuilder = RawStunMsgBuilder.from(raw);
  const vBuf = Buffer.alloc(MESSAGE_INTEGRITY_BYTES); // dummy content
  rawMsgBuilder.addAttr("messageIntegrity", vBuf);
  const integrity = calcMessageIntegrity({
    credentials,
    raw: rawMsgBuilder.raw,
  });

  return integrity;
}
