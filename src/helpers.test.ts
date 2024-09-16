import { expectTypeOf, test } from "vitest";
import { assertValueOf, isValueOf } from "./helpers.js";

const addrFamilyRecord = {
	ipV4: 0x01,
	ipV6: 0x02,
} as const;
type AddrFamilyRecord = typeof addrFamilyRecord;
type AddrFamily = (typeof addrFamilyRecord)[keyof typeof addrFamilyRecord];

test("isValueOf", () => {
	expectTypeOf(
		isValueOf<AddrFamilyRecord, AddrFamily>,
	).guards.toEqualTypeOf<AddrFamily>();
});

test("assertValueOf", () => {
	expectTypeOf(
		assertValueOf<AddrFamilyRecord, AddrFamily>,
	).asserts.toEqualTypeOf<AddrFamily>();
});
