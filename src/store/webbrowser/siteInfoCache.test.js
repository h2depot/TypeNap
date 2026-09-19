import { test } from "node:test";
import assert from "node:assert/strict";
import { createSiteInfoCache } from "./siteInfoCache.js";

test("partial metadata stays usable and expires sooner for retry", async () => {
    let now = 0;
    let calls = 0;
    const lookup = createSiteInfoCache(async (command) => {
        assert.equal(command, "get_site_info");
        calls++;
        return { success: false, title: null, icon: "https://example.com/icon.png", titleError: "No title", iconError: null };
    }, () => now);
    const [first, second] = await Promise.all([lookup("https://example.com"), lookup("https://example.com/")]);
    assert.equal(calls, 1);
    assert.equal(first, second);
    assert.equal(first.title, "https://example.com/");
    assert.equal(first.icon, "https://example.com/icon.png");
    assert.equal(first.titleError, "No title");
    now = 30_001;
    await lookup("https://example.com");
    assert.equal(calls, 2);
});

test("IPC failure resolves to a URL usable as the bookmark label", async () => {
    const lookup = createSiteInfoCache(() => { throw new Error("IPC unavailable"); });
    const info = await lookup("https://example.com/private");
    assert.equal(info.title, "https://example.com/private");
    assert.equal(info.success, false);
    assert.equal(info.icon, null);
    assert.match(info.titleError, /IPC unavailable/);
});
