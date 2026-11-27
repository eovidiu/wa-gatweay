import { test } from "node:test";
import assert from "node:assert/strict";

process.env.WA_MONGO_URL ||= "mongodb://127.0.0.1:1/unused";

const { Session } = await import("../dist/session.js");
const { generateWAMessageContent } = await import("baileys");

test("CAND-004: sendText disables link preview fetching so link-preview-js is never invoked for SSRF URLs", async () => {
    const calls = [];
    const session = new Session(
        {
            _id: "test-session",
            displayPhoneNumber: "15550001111",
            wabaId: "waba",
            webhookUrl: "",
            sendRatePerMinute: 60,
        },
        {
            messageKeys: { findOne: async () => null, updateOne: async () => {} },
            lidMap: { findOne: async () => null },
            chatlog: { insertOne: async () => {} },
        },
        {}
    );
    session.status = "connected";
    session.sock = {
        sendMessage: async (jid, content, opts) => {
            calls.push({ jid, content, opts });
            return { key: { id: "msg-1" } };
        },
    };

    await session.sendText("15551234567", "See http://127.0.0.1:8080/internal and http://[::1]/admin");
    assert.equal(calls.length, 1);
    const { content } = calls[0];
    assert.equal(content.linkPreview, null);

    // Verify Baileys' generateWAMessageContent does not call getUrlInfo when linkPreview is null
    let urlInfoCalled = false;
    await generateWAMessageContent(content, {
        getUrlInfo: async () => {
            urlInfoCalled = true;
            return undefined;
        },
    });
    assert.equal(urlInfoCalled, false, "generateWAMessageContent must not invoke getUrlInfo");
});
