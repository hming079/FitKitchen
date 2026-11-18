const service = require("./product.service");
const { validateCatalogId } = require("../meal/catalog.validation");
const { validateProductListQuery, validateProductPayload, validateStockAdjustment } = require("./product.validation");
const { validationError, notFound, conflict } = require("../meal/catalog.responses");

async function list(req, res, manage = false) {
    const { data, errors } = validateProductListQuery(req.query, manage);
    if (errors.length) return validationError(res, errors);
    return res.json({ success: true, ...await service.list(data) });
}

async function getById(req, res) {
    const id = validateCatalogId(req.params.id);
    if (id === null) return validationError(res, ["id must be a positive integer"]);
    const product = await service.findById(id);
    if (!product) return notFound(res, "Product");
    return res.json({ success: true, data: product });
}

async function create(req, res) {
    const { data, errors } = validateProductPayload(req.body);
    if (errors.length) return validationError(res, errors);
    const product = await service.create(data);
    return res.status(201).json({ success: true, data: product });
}

async function update(req, res, archive = false) {
    const id = validateCatalogId(req.params.id);
    if (id === null) return validationError(res, ["id must be a positive integer"]);
    const { data, errors } = archive
        ? { data: { is_available: false }, errors: [] }
        : validateProductPayload(req.body, { partial: true });
    if (errors.length) return validationError(res, errors);
    const product = await service.update(id, data);
    if (!product) return notFound(res, "Product");
    return res.json({ success: true, data: product });
}

async function adjustStock(req, res) {
    const id = validateCatalogId(req.params.id);
    if (id === null) return validationError(res, ["id must be a positive integer"]);
    const { data: adjustment, errors } = validateStockAdjustment(req.body);
    if (errors.length) return validationError(res, errors);
    const product = await service.adjustStock(id, adjustment);
    if (product) return res.json({ success: true, data: product });
    if (!await service.findById(id)) return notFound(res, "Product");
    if (adjustment < 0) return conflict(res, "INSUFFICIENT_STOCK", "Adjustment would make stock negative");
    return conflict(res, "STOCK_LIMIT_EXCEEDED", "Adjustment would exceed maximum stock");
}

module.exports = { list, getById, create, update, adjustStock };
