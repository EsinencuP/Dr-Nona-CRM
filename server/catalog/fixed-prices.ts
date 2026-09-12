import { z } from "zod";

// Zero is reserved for missing historical data; new approved entries must be positive.
export const fixedPriceSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/)
  .transform(Number)
  .pipe(z.number().finite().positive().max(1_000_000));
