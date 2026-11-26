const { customerRouter, adminRouter } = require("./promotion.routes");

module.exports = {
  basePath: "/api/promotions",
  customerRouter,
  adminRouter,
};
