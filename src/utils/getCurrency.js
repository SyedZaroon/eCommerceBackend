export const getCurrency = () => {
  const currency = (process.env.ORDER_CURRENCY || "PKR").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("ORDER_CURRENCY must be a three-letter currency code.");
  }
  return currency;
};