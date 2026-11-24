const service = require("./nutrition.service");
const { validateProfile } = require("./nutrition.validation");

module.exports = {
  async getProfile(req, res) {
    return res.json({ success: true, data: await service.getProfile(req.user.id) });
  },
  async saveProfile(req, res) {
    const data = await service.saveProfile(req.user.id, validateProfile(req.body));
    return res.json({ success: true, data });
  },
};
