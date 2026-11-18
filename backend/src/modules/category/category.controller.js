const service = require("./category.service");
const { validateCatalogId } = require("../meal/catalog.validation");
const { validateCategoryPayload } = require("./category.validation");
const { validationError, notFound, conflict } = require("../meal/catalog.responses");

async function list(req, res) {
    return res.json({ success: true, data: await service.list() });
}

async function getById(req, res) {
    const id = validateCatalogId(req.params.id);
    if (id === null) return validationError(res, ["id must be a positive integer"]);
    const category = await service.findById(id);
    if (!category) return notFound(res, "Category");
    return res.json({ success: true, data: category });
}

async function create(req, res) {
    const { data, errors } = validateCategoryPayload(req.body);
    if (errors.length) return validationError(res, errors);
    try {
        const category = await service.create(data);
        return res.status(201).json({ success: true, data: category });
    } catch (error) {
        if (error.code === "23505") return conflict(res, "CATEGORY_NAME_TAKEN", "Category name is already in use");
        throw error;
    }
}

async function update(req, res) {
    const id = validateCatalogId(req.params.id);
    if (id === null) return validationError(res, ["id must be a positive integer"]);
    const { data, errors } = validateCategoryPayload(req.body, { partial: true });
    if (errors.length) return validationError(res, errors);
    try {
        const category = await service.update(id, data);
        if (!category) return notFound(res, "Category");
        return res.json({ success: true, data: category });
    } catch (error) {
        if (error.code === "23505") return conflict(res, "CATEGORY_NAME_TAKEN", "Category name is already in use");
        throw error;
    }
}

async function remove(req, res) {
    const id = validateCatalogId(req.params.id);
    if (id === null) return validationError(res, ["id must be a positive integer"]);
    const result = await service.remove(id);
    if (!result) return notFound(res, "Category");
    if (result.meal_count) {
        return conflict(res, "CATEGORY_IN_USE", "Category is still referenced by meals", { meal_count: result.meal_count });
    }
    return res.json({ success: true, data: result });
}

module.exports = { list, getById, create, update, remove };
