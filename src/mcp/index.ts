// Entry point for the stdio MCP server (see server.ts). Claude launches this
// from whatever directory it's working in, and db.ts resolves ./data against
// the cwd — so pin the DB to this repo's data/ before db.ts is loaded, or a
// fresh empty database would be created next to whichever project Claude is in.
import path from "node:path";

process.env.DATABASE_DIR ??= path.resolve(__dirname, "../../data");

void import("./server");
