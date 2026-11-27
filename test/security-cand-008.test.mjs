import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("CAND-008: Dockerfile runs as a non-root user on an unprivileged port", () => {
    const df = readFileSync(resolve(root, "Dockerfile"), "utf8");
    const lines = df.split(/\r?\n/).map((l) => l.trim());

    const userLines = lines.filter((l) => /^USER\s+/i.test(l));
    assert.ok(userLines.length > 0, "Dockerfile must specify a USER directive");
    const lastUser = userLines[userLines.length - 1].replace(/^USER\s+/i, "").trim();
    assert.notEqual(lastUser, "root");
    assert.notEqual(lastUser, "0");
    assert.equal(lastUser, "node");

    const portMatch = df.match(/^ENV\s+PORT=(\d+)/m);
    assert.ok(portMatch, "Dockerfile must set ENV PORT=...");
    const port = Number(portMatch[1]);
    assert.ok(port >= 1024, `Expected unprivileged port >= 1024, got ${port}`);

    assert.match(df, new RegExp(`^EXPOSE\\s+${port}\\b`, "m"));
    assert.match(df, new RegExp(`http://localhost:${port}/api/health`));
    assert.match(df, /chown\s+-R\s+node:node\s+.*\/tmp\/wa-media/);
});
