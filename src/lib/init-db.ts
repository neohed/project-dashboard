// Importing db.ts is enough to create the SQLite file + schema (CREATE TABLE
// IF NOT EXISTS runs on module load). This script exists mainly so the setup
// step is explicit and documented in the README / package.json scripts.
import "./db";

console.log("Database ready.");
