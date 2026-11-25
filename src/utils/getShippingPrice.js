export const SHIPPING_METHODS = Object.freeze({
  STANDARD: "standard",
  NEXT_DAY: "next_day",
});

export const NEXT_DAY_SHIPPING_PRICE = 250;

export const getShippingPrice = (
  itemsPrice,
  shippingMethod = SHIPPING_METHODS.STANDARD,
) => {
  if (!Number.isFinite(itemsPrice) || itemsPrice < 0) {
    throw new Error("Order subtotal must be a non-negative number.");
  }
  if (!Object.values(SHIPPING_METHODS).includes(shippingMethod)) {
    throw new Error("Shipping method is invalid.");
  }
  if (shippingMethod === SHIPPING_METHODS.NEXT_DAY) {
    return NEXT_DAY_SHIPPING_PRICE;
  }

  return 0;
};