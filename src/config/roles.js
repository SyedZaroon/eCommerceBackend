export const PERMISSIONS = {
  PRODUCTS: {
    CREATE: ["Admin", "Manager"],
    UPDATE: ["Admin", "Manager"],
    DELETE: ["Admin"],
    READ: ["Admin", "Manager"],
    VIEW: ["Customer"],
  },
  COLLECTION: {
    CREATE: ["Admin", "Manager"],
    UPDATE: ["Admin", "Manager"],
    DELETE: ["Admin"],
    READ: ["Admin", "Manager"],
    VIEW: ["Customer"],
  },
  USER: {
    CREATE: ["Admin"],
    DELETE: ["Admin"],
    UPDATE: ["Admin"],
    READ: ["Admin", "Manager"],
  },
};
