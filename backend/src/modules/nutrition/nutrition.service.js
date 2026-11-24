const pool = require("../../config/database");

const activityFactors = { SEDENTARY: 1.2, LIGHT: 1.375, MODERATE: 1.55, ACTIVE: 1.725, VERY_ACTIVE: 1.9 };
const goalAdjustments = { FAT_LOSS: -300, MAINTENANCE: 0, MUSCLE_GAIN: 200 };

function calculate(profile) {
  const bmr = 10 * Number(profile.weight_kg) + 6.25 * Number(profile.height_cm) - 5 * profile.age + (profile.gender === "MALE" ? 5 : -161);
  const tdee = bmr * activityFactors[profile.activity_level];
  const targetCalories = Math.round(tdee + goalAdjustments[profile.goal]);
  const proteinG = Math.round(1.8 * Number(profile.weight_kg));
  const fatG = Math.round(0.8 * Number(profile.weight_kg));
  const carbsG = Math.max(0, Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4));
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), target_calories: targetCalories, macros: { protein_g: proteinG, fat_g: fatG, carbs_g: carbsG } };
}

function recommend(meals, targets) {
  const perMeal = { calories: targets.target_calories / 3, protein_g: targets.macros.protein_g / 3, carbs_g: targets.macros.carbs_g / 3, fat_g: targets.macros.fat_g / 3 };
  const groups = {};
  for (const meal of meals) {
    const type = meal.meal_type || "OTHER";
    const score = ["calories", "protein_g", "carbs_g", "fat_g"].reduce((sum, key) => {
      const expected = perMeal[key];
      return sum + Math.abs(Number(meal[key]) - expected) / Math.max(expected, 1);
    }, 0);
    (groups[type] ||= []).push({ ...meal, recommendation_score: Number(score.toFixed(3)) });
  }
  return Object.fromEntries(Object.entries(groups).map(([type, items]) => [type, items.sort((a,b) => a.recommendation_score - b.recommendation_score).slice(0, 4)]));
}

async function getProfile(userId) {
  const { rows } = await pool.query(
    `SELECT gender, age, height_cm, weight_kg, activity_level, goal, created_at, updated_at
     FROM nutrition_profiles WHERE user_id = $1`, [userId]);
  if (!rows[0]) return null;
  const profile = { ...rows[0], age: Number(rows[0].age), height_cm: Number(rows[0].height_cm), weight_kg: Number(rows[0].weight_kg) };
  const targets = calculate(profile);
  const { rows: meals } = await pool.query(
    `SELECT id::text, category_id::text, name, description, image_url, price, calories, protein_g, carbs_g, fat_g,
            meal_type, goal_type, allergen_info, is_available
     FROM meals WHERE is_available = TRUE AND (meal_type IS NULL OR meal_type <> 'TOPPING') ORDER BY id LIMIT 200`);
  const numericMeals = meals.map((meal) => Object.fromEntries(Object.entries(meal).map(([key, value]) =>
    [key, ["price", "calories", "protein_g", "carbs_g", "fat_g"].includes(key) ? Number(value) : value])));
  return { profile, targets, recommendations: recommend(numericMeals, targets) };
}

async function saveProfile(userId, data) {
  await pool.query(
    `INSERT INTO nutrition_profiles (user_id, gender, age, height_cm, weight_kg, activity_level, goal)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id) DO UPDATE SET gender = EXCLUDED.gender, age = EXCLUDED.age,
       height_cm = EXCLUDED.height_cm, weight_kg = EXCLUDED.weight_kg,
       activity_level = EXCLUDED.activity_level, goal = EXCLUDED.goal, updated_at = CURRENT_TIMESTAMP`,
    [userId, data.gender, data.age, data.height_cm, data.weight_kg, data.activity_level, data.goal]);
  return getProfile(userId);
}

module.exports = { getProfile, saveProfile, calculate, recommend };
