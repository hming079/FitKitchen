const path = require('node:path');

// Process environment wins, then backend/.env, then the repository .env.
// Resolve against this module so scripts behave consistently from any cwd.
require('dotenv').config({
    path: [path.join(__dirname, '../../.env'), path.join(__dirname, '../../../.env')],
    quiet: true
});
