const pool = require("../../config/database");

const vietnameseAccents = {
    a: "àáảãạăằắẳẵặâầấẩẫậ",
    e: "èéẻẽẹêềếểễệ",
    i: "ìíỉĩị",
    o: "òóỏõọôồốổỗộơờớởỡợ",
    u: "ùúủũụưừứửữự",
    y: "ỳýỷỹỵ",
    d: "đ"
};
const accented = Object.values(vietnameseAccents).join("");
const plain = Object.entries(vietnameseAccents).map(([letter, variants]) => letter.repeat(variants.length)).join("");

function catalogSearchPattern(search) {
    const folded = search.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d");
    return `%${(folded || search).replace(/[\\%_]/g, "\\$&")}%`;
}

function addCatalogSearch(search, conditions, values) {
    if (!search) return;
    const parameter = values.push(catalogSearchPattern(search));
    const matches = column =>
        `translate(lower(normalize(${column})), '${accented}', '${plain}') ILIKE $${parameter} ESCAPE E'\\\\'`;
    conditions.push(`(${matches("name")} OR ${matches("description")})`);
}

async function listPage({ table, columns, conditions, values, order, page, page_size }) {
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(
        `WITH filtered AS NOT MATERIALIZED (SELECT ${columns} FROM ${table} ${where})
         SELECT paged.*, totals.total
         FROM (SELECT COUNT(*) AS total FROM filtered) AS totals
         LEFT JOIN (
             SELECT * FROM filtered ORDER BY ${order}
             LIMIT $${values.length + 1} OFFSET $${values.length + 2}
         ) AS paged ON TRUE
         ORDER BY ${order}`,
        [...values, page_size, (page - 1) * page_size]
    );
    const total = Number(rows[0].total);
    return {
        data: rows.filter(row => row.id !== null).map(({ total, ...record }) => record),
        pagination: { page, page_size, total, total_pages: Math.ceil(total / page_size) }
    };
}

module.exports = { addCatalogSearch, catalogSearchPattern, listPage };
