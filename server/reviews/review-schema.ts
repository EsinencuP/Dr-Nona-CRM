import { z } from "zod";

export const reviewInputSchema = z
  .object({
    authorName: z.string().trim().min(2).max(80),
    body: z.string().trim().min(10).max(3000),
    productSlug: z.string().max(160).nullable(),
    locale: z.enum(["ru", "ro"]),
    consentAccepted: z.literal(true),
    website: z.string().max(0),
  })
  .strict();

export const moderationSchema = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().nonnegative(),
  status: z.enum(["APPROVED", "REJECTED"]),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;
