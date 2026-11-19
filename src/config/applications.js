export const APPLICATIONS = {
  client: {
    origin: "http://localhost:3000",
    cookieName: "clientToken",
    roles: ["Admin", "Manager", "Customer"],
  },
  dashboard: {
    origin: "http://localhost:5173",
    cookieName: "dashboardToken",
    roles: ["Admin", "Manager"],
  },
};

export const getApplication = (origin) =>
  Object.values(APPLICATIONS).find((application) => application.origin === origin);
