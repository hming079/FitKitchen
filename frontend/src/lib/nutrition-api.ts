import { z } from "zod";
import { api } from "@/lib/admin-api";
import { mealSchema } from "@/lib/catalog-api";

const profileSchema = z.object({
  gender: z.enum(["MALE", "FEMALE"]),
  age: z.number(),
  height_cm: z.number(),
  weight_kg: z.number(),
  activity_level: z.enum(["SEDENTARY", "LIGHT", "MODERATE", "ACTIVE", "VERY_ACTIVE"]),
  goal: z.enum(["FAT_LOSS", "MAINTENANCE", "MUSCLE_GAIN"]),
});
const dataSchema = z.object({
  profile: profileSchema,
  targets: z.object({
    bmr: z.number(),
    tdee: z.number(),
    target_calories: z.number(),
    macros: z.object({ protein_g: z.number(), fat_g: z.number(), carbs_g: z.number() }),
  }),
  recommendations: z.record(
    z.string(),
    z.array(mealSchema.extend({ recommendation_score: z.number() })),
  ),
});
const responseSchema = z.object({ success: z.literal(true), data: dataSchema.nullable() });

export type NutritionProfile = z.infer<typeof profileSchema>;
export type NutritionData = z.infer<typeof dataSchema>;

export const nutritionApi = {
  getProfile: (signal?: AbortSignal) => api("/nutrition/profile", responseSchema, { signal }),
  saveProfile: (profile: NutritionProfile) =>
    api("/nutrition/profile", responseSchema, { method: "PUT", body: JSON.stringify(profile) }),
};
