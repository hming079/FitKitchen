function validationError(res, errors) {
    return res.status(400).json({ success: false, message: "Validation failed", errors });
}

function notFound(res, resource) {
    return res.status(404).json({ success: false, message: `${resource} not found` });
}

function conflict(res, code, message, details) {
    return res.status(409).json({ success: false, code, message, ...details });
}

module.exports = { validationError, notFound, conflict };
