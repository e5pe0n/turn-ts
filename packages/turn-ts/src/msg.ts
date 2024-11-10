import {
  type StunMsg,
  buildStunMsgDecoder,
  buildStunMsgEncoder,
} from "@e5pe0n/stun-ts";
import {
  type InputTurnAttr,
  type OutputTurnAttr,
  turnAttrTypeRecord,
  turnAttrvDecoders,
  turnAttrvEncoders,
} from "./attr.js";
import { type TurnMsgMethods, turnMsgMethodRecord } from "./method.js";

export type TurnMsg = StunMsg<TurnMsgMethods, OutputTurnAttr>;

export const encodeTurnMsg = buildStunMsgEncoder<TurnMsgMethods, InputTurnAttr>(
  turnMsgMethodRecord,
  turnAttrTypeRecord,
  turnAttrvEncoders,
);

export const decodeTurnMsg = buildStunMsgDecoder<
  TurnMsgMethods,
  OutputTurnAttr
>(turnMsgMethodRecord, turnAttrTypeRecord, turnAttrvDecoders);
