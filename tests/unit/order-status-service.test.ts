import { describe, expect, test } from "vitest";

import { canTransitionOrderStatus } from "../../server/orders/order-status-service";

const statuses = ["NEW", "PROCESSING", "DELIVERY", "DONE", "CANCELLED"] as const;
const legal = new Set([
  "NEW:NEW",
  "NEW:PROCESSING",
  "NEW:CANCELLED",
  "PROCESSING:PROCESSING",
  "PROCESSING:DELIVERY",
  "PROCESSING:DONE",
  "PROCESSING:CANCELLED",
  "DELIVERY:DELIVERY",
  "DELIVERY:DONE",
  "DELIVERY:CANCELLED",
  "DONE:DONE",
  "CANCELLED:CANCELLED",
]);

describe("order lifecycle", () => {
  test("defines every legal and illegal status pair explicitly", () => {
    for (const from of statuses) {
      for (const to of statuses) {
        expect(canTransitionOrderStatus(from, to), `${from} -> ${to}`).toBe(legal.has(`${from}:${to}`));
      }
    }
  });
});
