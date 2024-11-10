import { type StunMsg, buildMsgEncoder } from "@e5pe0n/stun-ts";
import {
  type InputTurnAttr,
  type OutputTurnAttr,
  turnAttrTypeRecord,
  turnAttrvEncoders,
} from "./attr.js";
import { type TurnMsgMethods, turnMsgMethodRecord } from "./method.js";

export type TurnMsg = StunMsg<TurnMsgMethods, OutputTurnAttr>;

export const encodeTurnMsg = buildMsgEncoder<TurnMsgMethods, InputTurnAttr>(
  turnMsgMethodRecord,
  turnAttrTypeRecord,
  turnAttrvEncoders,
);
