const mealService = require("./meal.service");
const { validateId, validateMealListQuery, validateMealPayload } = require("./meal.validation");
const { validateCatalogId } = require("./catalog.validation");
const { validateOptionPayload } = require("./option.validation");
const { validationError, notFound, conflict } = require("./catalog.responses");

const mealWriteErrors = new Map([
    ["23503", "category_id does not reference an existing category"],
    ["22003", "A numeric meal field exceeds its allowed range"],
    ["22001", "A text meal field exceeds its allowed length"],
    ["22021", "A text meal field contains invalid characters"]
]);

class MealController {
    async list(req, res, manage = false) {
        const { data, errors } = validateMealListQuery(req.query, manage);
        if (errors.length) return validationError(res, errors);
        return res.json({ success: true, ...await mealService.list(data) });
    }

    async getById(req, res) {
        const id = validateId(req.params.id);
        if (id === null) {
            return validationError(res, ["id must be a positive integer"]);
        }

        try {
            const meal = await mealService.findById(id);
            if (!meal) return notFound(res, "Meal");
            return res.json({ success: true, data: meal });
        } catch (error) {
            console.error(`Error getting meal ${id}:`, error.code || error.name, error.message);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    async getCustomizations(req, res, manage = false) {
        const id = validateId(req.params.id);
        if (id === null) return validationError(res, ["id must be a positive integer"]);

        const options = await mealService.getCustomizations(id, manage);
        if (options === null) return notFound(res, "Meal");
        return res.json({ success: true, data: options });
    }

    async createCustomization(req, res) {
        const id = validateId(req.params.id);
        if (id === null) return validationError(res, ["id must be a positive integer"]);
        const { data, errors } = validateOptionPayload(req.body);
        if (errors.length) return validationError(res, errors);
        try {
            const option = await mealService.createCustomization(id, data);
            return res.status(201).json({ success: true, data: option });
        } catch (error) {
            if (error.code === "23503") return notFound(res, "Meal");
            if (error.code === "23505") return conflict(res, "OPTION_NAME_TAKEN", "Option name is already in use for this meal");
            throw error;
        }
    }

    async updateCustomization(req, res, archive = false) {
        const id = validateId(req.params.id);
        const optionId = validateCatalogId(req.params.optionId);
        if (id === null || optionId === null) {
            return validationError(res, [`${id === null ? "id" : "optionId"} must be a positive integer`]);
        }
        const { data, errors } = archive
            ? { data: { is_available: false }, errors: [] }
            : validateOptionPayload(req.body, { partial: true });
        if (errors.length) return validationError(res, errors);
        try {
            const option = await mealService.updateCustomization(id, optionId, data);
            if (!option) return notFound(res, "Option");
            return res.json({ success: true, data: option });
        } catch (error) {
            if (error.code === "23505") return conflict(res, "OPTION_NAME_TAKEN", "Option name is already in use for this meal");
            throw error;
        }
    }

    async create(req, res) {
        const { data, errors } = validateMealPayload(req.body);
        if (errors.length > 0) {
            return validationError(res, errors);
        }

        try {
            const meal = await mealService.create(data);
            return res.status(201).json({ success: true, data: meal });
        } catch (error) {
            const message = mealWriteErrors.get(error.code);
            if (message) return validationError(res, [message]);
            console.error("Error creating meal:", error.code || error.name, error.message);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    async update(req, res) {
        const id = validateId(req.params.id);
        if (id === null) {
            return validationError(res, ["id must be a positive integer"]);
        }

        const { data, errors } = validateMealPayload(req.body, { partial: true });
        if (errors.length > 0) {
            return validationError(res, errors);
        }

        try {
            const meal = await mealService.update(id, data);
            if (!meal) return notFound(res, "Meal");
            return res.json({ success: true, data: meal });
        } catch (error) {
            const message = mealWriteErrors.get(error.code);
            if (message) return validationError(res, [message]);
            console.error(`Error updating meal ${id}:`, error.code || error.name, error.message);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }

    async archive(req, res) {
        const id = validateId(req.params.id);
        if (id === null) {
            return validationError(res, ["id must be a positive integer"]);
        }

        try {
            const meal = await mealService.archive(id);
            if (!meal) return notFound(res, "Meal");
            return res.json({ success: true, data: meal });
        } catch (error) {
            console.error(`Error archiving meal ${id}:`, error.code || error.name, error.message);
            return res.status(500).json({ success: false, message: "Internal server error" });
        }
    }
}

module.exports = new MealController();
