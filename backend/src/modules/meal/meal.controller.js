const mealService = require("./meal.service");
const {
    mealTypes,
    validateId,
    validateMealPayload
} = require("./meal.validation");

function sendValidationError(res, errors) {
    return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors
    });
}

class MealController {
    async list(req, res) {
        const categoryId = req.query.category_id === undefined
            ? undefined
            : validateId(req.query.category_id);

        if (req.query.category_id !== undefined && categoryId === null) {
            return sendValidationError(res, ["category_id must be a positive integer"]);
        }

        if (req.query.available !== undefined &&
            req.query.available !== "true" && req.query.available !== "false") {
            return sendValidationError(res, ["available must be true or false"]);
        }

        if (req.query.meal_type !== undefined && !mealTypes.has(req.query.meal_type)) {
            return sendValidationError(res, [
                "meal_type must be SINGLE, COMBO_7_DAYS, or TOPPING"
            ]);
        }

        try {
            const meals = await mealService.list({
                search: typeof req.query.search === "string" ? req.query.search.trim() : undefined,
                categoryId,
                mealType: req.query.meal_type,
                available: req.query.available === undefined
                    ? undefined
                    : req.query.available === "true"
            });
            return res.json({ success: true, data: meals });
        } catch (error) {
            console.error("Error listing meals:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    async getById(req, res) {
        const id = validateId(req.params.id);
        if (id === null) {
            return sendValidationError(res, ["id must be a positive integer"]);
        }

        try {
            const meal = await mealService.findById(id);
            if (!meal) {
                return res.status(404).json({ success: false, message: "Meal not found" });
            }
            return res.json({ success: true, data: meal });
        } catch (error) {
            console.error(`Error getting meal ${id}:`, error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    async getCustomizations(req, res) {
        const id = validateId(req.params.id);
        if (id === null) {
            return sendValidationError(res, ["id must be a positive integer"]);
        }

        try {
            const meal = await mealService.findById(id);
            if (!meal) {
                return res.status(404).json({ success: false, message: "Meal not found" });
            }
            return res.json({
                success: true,
                data: await mealService.getCustomizations(id)
            });
        } catch (error) {
            console.error(`Error getting customizations for meal ${id}:`, error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    async create(req, res) {
        const { data, errors } = validateMealPayload(req.body);
        if (errors.length > 0) {
            return sendValidationError(res, errors);
        }

        try {
            const meal = await mealService.create(data);
            return res.status(201).json({ success: true, data: meal });
        } catch (error) {
            console.error("Error creating meal:", error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    async update(req, res) {
        const id = validateId(req.params.id);
        if (id === null) {
            return sendValidationError(res, ["id must be a positive integer"]);
        }

        const { data, errors } = validateMealPayload(req.body, { partial: true });
        if (errors.length > 0) {
            return sendValidationError(res, errors);
        }

        try {
            const meal = await mealService.update(id, data);
            if (!meal) {
                return res.status(404).json({ success: false, message: "Meal not found" });
            }
            return res.json({ success: true, data: meal });
        } catch (error) {
            console.error(`Error updating meal ${id}:`, error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    async archive(req, res) {
        const id = validateId(req.params.id);
        if (id === null) {
            return sendValidationError(res, ["id must be a positive integer"]);
        }

        try {
            const meal = await mealService.archive(id);
            if (!meal) {
                return res.status(404).json({ success: false, message: "Meal not found" });
            }
            return res.json({ success: true, data: meal });
        } catch (error) {
            console.error(`Error archiving meal ${id}:`, error);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}

module.exports = new MealController();
