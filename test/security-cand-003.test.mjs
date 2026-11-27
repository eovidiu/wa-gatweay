import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import zlib from "node:zlib";
import express from "express";

process.env.WA_MONGO_URL ||= "mongodb://127.0.0.1:1/unused";

const configMod = await import("../dist/config.js");

test("CAND-003: express.json rejects compressed bodies (inflate: false) instead of invoking vulnerable decompression", async () => {
    assert.ok(configMod.JSON_BODY_OPTIONS, "JSON_BODY_OPTIONS must be exported from config");
    assert.equal(configMod.JSON_BODY_OPTIONS.inflate, false);

    const app = express();
    app.use(express.json(configMod.JSON_BODY_OPTIONS));
    app.post("/test", (req, res) => res.json({ ok: true, body: req.body }));

    const srv = http.createServer(app);
    await new Promise((r) => srv.listen(0, "127.0.0.1", r));
    const base = `http://127.0.0.1:${srv.address().port}`;

    try {
        // Valid gzip frame followed by trailing garbage bytes (CVE-2026-111181 trigger)
        const payload = Buffer.concat([
            zlib.gzipSync(Buffer.from('{"ok":true}')),
            Buffer.from([0xde, 0xad, 0xbe, 0xef]),
        ]);
        const res = await fetch(`${base}/test`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "content-encoding": "gzip",
            },
            body: payload,
        });
        assert.equal(res.status, 415);

        // Normal uncompressed JSON still works
        const okRes = await fetch(`${base}/test`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ hello: "world" }),
        });
        assert.equal(okRes.status, 200);
        const data = await okRes.json();
        assert.deepEqual(data, { ok: true, body: { hello: "world" } });
    } finally {
        srv.close();
    }
});
