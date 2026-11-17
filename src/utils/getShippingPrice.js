import { roundMoney } from "./roundMoney.js";

export const getShippingPrice = (itemsPrice) => {
  const threshold = Number(process.env.FREE_SHIPPING_THRESHOLD ?? 5000);
  const fee = Number(process.env.SHIPPING_PRICE ?? 250);
  if (
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    !Number.isFinite(fee) ||
    fee < 0
  ) {
    throw new Error("Shipping configuration is invalid.");
  }
  return itemsPrice > threshold ? 0 : roundMoney(fee);
};