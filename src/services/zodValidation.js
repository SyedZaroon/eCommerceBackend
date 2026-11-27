import { z } from "zod";

export const shippingAddressSchema = z.object({
  postalCode: z.string().trim().min(1).max(30),
  address: z.string().trim().min(1).max(300),
  additionalInfo: z.string().trim().max(300).optional().default(""),
  town: z.string().trim().min(1).max(100),
  country: z.string().trim().min(2).max(100).default("Pakistan"),
});

export const shippingMethodSchema = z.enum(["standard", "next_day"]);

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
  shippingMethod: shippingMethodSchema.default("standard"),
  paymentMethod: z.enum(["COD", "JazzCash", "EasyPaisa", "Stripe"]),
});

export const updateOrderSchema = z
  .object({
    customerName: z.string().trim().min(1).max(120),
    customerEmail: z.string().trim().email().max(254),
    customerPhone: z.string().trim().min(1).max(40),
    userInfo: z
      .object({
        fullName: z.string().trim().min(1).max(120),
        email: z.string().trim().email().max(254),
        phoneNumber: z.string().trim().min(1).max(40),
      })
      .partial()
      .strict()
      .refine((value) => Object.keys(value).length > 0, "At least one customer field is required."),
    shippingAddress: z
      .object({
        postCode: z.string().trim().min(1).max(30),
        address: z.string().trim().min(1).max(300),
        additionalInfo: z.string().trim().max(300),
        town: z.string().trim().min(1).max(100),
        country: z.string().trim().min(2).max(100),
      })
      .partial()
      .strict()
      .refine((value) => Object.keys(value).length > 0, "At least one shipping field is required."),
    orderItems: z
      .array(
        z.object({
          product: z.string().regex(/^[a-f\d]{24}$/i),
          qty: z.number().int().min(1).max(1000),
        }),
      )
      .min(1)
      .max(50),
    paymentMethod: z.enum(["COD", "JazzCash", "EasyPaisa", "Stripe"]),
    paymentStatus: z.enum(["Pending", "Paid", "Failed", "Refunded"]),
    orderStatus: z.enum([
      "Pending",
      "Processing",
      "Shipped",
      "Delivered",
      "Cancelled",
    ]),
    shippingPrice: z.number().finite().min(0),
    shippingMethod: shippingMethodSchema,
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "At least one order field is required.");