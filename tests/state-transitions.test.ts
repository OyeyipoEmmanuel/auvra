import { describe, expect, it } from "vitest";

import {
  assertTransition,
  canTransition,
  paymentTransitions,
  projectTransitions,
  receiptAnchorTransitions,
  requestTransitions,
  supplierJobTransitions,
} from "../packages/contracts/src/index.js";

describe("Auvra lifecycle transitions", () => {
  it("allows the guarded request happy path", () => {
    expect(canTransition(requestTransitions, "DRAFT", "SUBMITTED")).toBe(true);
    expect(canTransition(requestTransitions, "AWAITING_FUNDS", "FUNDED")).toBe(true);
    expect(canTransition(requestTransitions, "FUNDED", "PROJECT_CREATED")).toBe(true);
  });

  it("prevents request state skipping and terminal rewrites", () => {
    expect(canTransition(requestTransitions, "DRAFT", "FUNDED")).toBe(false);
    expect(canTransition(requestTransitions, "PROJECT_CREATED", "DRAFT")).toBe(false);
    expect(() => assertTransition(requestTransitions, "QUOTED", "FUNDED")).toThrow(/Illegal state transition/);
  });

  it("keeps procurement behind an explicit supplier approval", () => {
    expect(canTransition(supplierJobTransitions, "PROPOSED", "CREATE_PENDING")).toBe(false);
    expect(canTransition(supplierJobTransitions, "PROPOSED", "APPROVED_TO_HIRE")).toBe(true);
    expect(canTransition(supplierJobTransitions, "APPROVED_TO_HIRE", "CREATE_PENDING")).toBe(true);
  });

  it("does not treat payment redirects as verification", () => {
    expect(canTransition(paymentTransitions, "CREATED", "VERIFIED")).toBe(false);
    expect(canTransition(paymentTransitions, "PENDING", "VERIFIED")).toBe(true);
  });

  it("requires QA and customer review before delivery", () => {
    expect(canTransition(projectTransitions, "RUNNING", "DELIVERED")).toBe(false);
    expect(canTransition(projectTransitions, "QA", "CUSTOMER_REVIEW")).toBe(true);
    expect(canTransition(projectTransitions, "CUSTOMER_REVIEW", "DELIVERED")).toBe(true);
  });

  it("makes confirmed receipt anchors terminal", () => {
    expect(canTransition(receiptAnchorTransitions, "SUBMITTED", "CONFIRMED")).toBe(true);
    expect(canTransition(receiptAnchorTransitions, "CONFIRMED", "SUBMITTED")).toBe(false);
  });
});
