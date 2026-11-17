export const roundMoney = (amount) =>
  Math.round((amount + Number.EPSILON) * 100) / 100;