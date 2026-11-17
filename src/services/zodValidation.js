import { z } from "zod";

export const shippingAddressSchema = z.object({
  postalCode: z.string().trim().min(1).max(30),
  address: z.string().trim().min(1).max(300),
  additionalInfo: z.string().trim().max(300).optional().default(""),
  town: z.string().trim().min(1).max(100),
  country: z.string().trim().min(2).max(100).default("Pakistan"),
});

export const createOrderSchema = z.object({
  orderItems: z
    .array(
      z.object({
        product: z.string().regex(/^[a-f\d]{24}$/i),
        qty: z.number().int().min(1).max(1000),
      }),
    )
    .min(1)
    .max(50),
  userInfo: z
    .object({
      name: z.string().trim().min(1).max(120).optional(),
      email: z.string().trim().email().max(254).optional(),
      phone: z.string().trim().min(1).max(40),
    })
    .optional(),
  shippingAddress: shippingAddressSchema,
  paymentMethod: z.enum(["COD", "JazzCash", "EasyPaisa"]),
});