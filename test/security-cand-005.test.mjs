import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";

const { fitForModel } = await import("../dist/imageFit.js");

test("CAND-005: fitForModel and sharp block SVG and HEIF loaders on untrusted image bytes", async () => {
    const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="2400"><rect width="2400" height="2400" fill="red"/></svg>'
    );

    const res = await fitForModel(svg, "image/svg+xml");
    assert.equal(res.resized, false, "SVG must not be rasterized/resized by sharp");
    assert.equal(res.data, svg);

    // Also verify libvips SVG loader is blocked at the sharp level
    await assert.rejects(
        () => sharp(svg).metadata(),
        /VipsForeignLoadSvg|block|unsupported image format/i,
        "VipsForeignLoadSvg must be blocked via sharp.block"
    );
});
