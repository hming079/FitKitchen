const userService = require("./user.service");
const { hashPassword } = require("./user.security");
const {
    fitnessGoals,
    roles,
    validateAddressPayload,
    validateId,
    validateUserPayload
} = require("./user.validation");

function validationError(res, errors) {
    return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors
    });
}

function handleDatabaseError(res, error) {
    if (error.code === "23505") {
        return res.status(409).json({
            success: false,
            message: "Email is already in use"
        });
    }
    console.error("User module database error:", error);
    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
}

class UserController {
    async list(req, res) {
        if (req.query.role !== undefined && !roles.has(req.query.role)) {
            return validationError(res, ["role must be CUSTOMER or ADMIN"]);
        }
        if (req.query.fitness_goal !== undefined && !fitnessGoals.has(req.query.fitness_goal)) {
            return validationError(res, ["fitness_goal must be BULK, CUT, or MAINTAIN"]);
        }

        try {
            const users = await userService.list({
                search: typeof req.query.search === "string" ? req.query.search.trim() : undefined,
                role: req.query.role,
                fitnessGoal: req.query.fitness_goal
            });
            return res.json({ success: true, data: users });
        } catch (error) {
            return handleDatabaseError(res, error);
        }
    }

    async getById(req, res) {
        const id = validateId(req.params.id);
        if (id === null) {
            return validationError(res, ["id must be a positive integer"]);
        }

        try {
            const user = await userService.findById(id);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }
            return res.json({ success: true, data: user });
        } catch (error) {
            return handleDatabaseError(res, error);
        }
    }

    async create(req, res) {
        const { data, errors } = validateUserPayload(req.body);
        if (errors.length > 0) {
            return validationError(res, errors);
        }

        try {
            data.password_hash = await hashPassword(data.password);
            delete data.password;
            const user = await userService.create(data);
            return res.status(201).json({ success: true, data: user });
        } catch (error) {
            return handleDatabaseError(res, error);
        }
    }

    async update(req, res) {
        const id = validateId(req.params.id);
        if (id === null) {
            return validationError(res, ["id must be a positive integer"]);
        }

        const { data, errors } = validateUserPayload(req.body, { partial: true });
        if (errors.length > 0) {
            return validationError(res, errors);
        }

        try {
            if (data.password !== undefined) {
                data.password_hash = await hashPassword(data.password);
                delete data.password;
            }
            const user = await userService.update(id, data);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }
            return res.json({ success: true, data: user });
        } catch (error) {
            return handleDatabaseError(res, error);
        }
    }

    async remove(req, res) {
        const id = validateId(req.params.id);
        if (id === null) {
            return validationError(res, ["id must be a positive integer"]);
        }

        try {
            const user = await userService.remove(id);
            if (!user) {
                return res.status(404).json({ success: false, message: "User not found" });
            }
            return res.status(204).send();
        } catch (error) {
            return handleDatabaseError(res, error);
        }
    }

    async listAddresses(req, res) {
        const userId = validateId(req.params.userId);
        if (userId === null) {
            return validationError(res, ["userId must be a positive integer"]);
        }

        try {
            if (!(await userService.findById(userId))) {
                return res.status(404).json({ success: false, message: "User not found" });
            }
            return res.json({
                success: true,
                data: await userService.listAddresses(userId)
            });
        } catch (error) {
            return handleDatabaseError(res, error);
        }
    }

    async createAddress(req, res) {
        const userId = validateId(req.params.userId);
        if (userId === null) {
            return validationError(res, ["userId must be a positive integer"]);
        }
        const { data, errors } = validateAddressPayload(req.body);
        if (errors.length > 0) {
            return validationError(res, errors);
        }

        try {
            if (!(await userService.findById(userId))) {
                return res.status(404).json({ success: false, message: "User not found" });
            }
            return res.status(201).json({
                success: true,
                data: await userService.createAddress(userId, data)
            });
        } catch (error) {
            return handleDatabaseError(res, error);
        }
    }

    async updateAddress(req, res) {
        const userId = validateId(req.params.userId);
        const addressId = validateId(req.params.addressId);
        if (userId === null || addressId === null) {
            return validationError(res, ["userId and addressId must be positive integers"]);
        }
        const { data, errors } = validateAddressPayload(req.body, { partial: true });
        if (errors.length > 0) {
            return validationError(res, errors);
        }

        try {
            const address = await userService.updateAddress(userId, addressId, data);
            if (!address) {
                return res.status(404).json({ success: false, message: "Address not found" });
            }
            return res.json({ success: true, data: address });
        } catch (error) {
            return handleDatabaseError(res, error);
        }
    }

    async removeAddress(req, res) {
        const userId = validateId(req.params.userId);
        const addressId = validateId(req.params.addressId);
        if (userId === null || addressId === null) {
            return validationError(res, ["userId and addressId must be positive integers"]);
        }

        try {
            const address = await userService.removeAddress(userId, addressId);
            if (!address) {
                return res.status(404).json({ success: false, message: "Address not found" });
            }
            return res.status(204).send();
        } catch (error) {
            return handleDatabaseError(res, error);
        }
    }
}

module.exports = new UserController();
