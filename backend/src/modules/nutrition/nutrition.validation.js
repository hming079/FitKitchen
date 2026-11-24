const choices = {
  gender: ["MALE", "FEMALE"],
  activity_level: ["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"],
  goal: ["FAT_LOSS", "MAINTENANCE", "MUSCLE_GAIN"],
};

function validateProfile(body) {
  const errors = [];
  const data = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    const error = new Error("A profile object is required");
    error.status = 400;
    error.code = "INVALID_PROFILE";
    throw error;
  }
  for (const [field, allowed] of Object.entries(choices)) {
    if (!allowed.includes(body[field])) errors.push(`${field} must be one of ${allowed.join(", ")}`);
    else data[field] = body[field];
  }
  for (const [field, min, max, integer] of [["age",18,100,true],["height_cm",130,230,false],["weight_kg",35,300,false]]) {
    const value = body[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      errors.push(`${field} must be a ${integer ? "whole number" : "number"} between ${min} and ${max}`);
    } else data[field] = value;
  }
  if (errors.length) {
    const error = new Error(errors[0]);
    error.status = 400;
    error.code = "INVALID_PROFILE";
    error.errors = errors;
    throw error;
  }
  return data;
}

module.exports = { validateProfile };
