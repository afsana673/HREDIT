
/**
 * HR HABIB — Instagram GC Pending Manager
 * API: https://hr-expb.onrender.com
 * Package: @eryxenx/insta-chat v2.2.7
 * Author: SK HABIBULLA
 */

const API_URL = "https://hr-expb.onrender.com";
const CACHE_TTL = 5 * 60 * 1000;
const ACTION_DELAY = 500;

if (!global.__HR_PENDING_CACHE) {
  global.__HR_PENDING_CACHE = {};
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  config: {
    name: "pending",
    aliases: ["gcpending", "gcrequest"],
    version: "1.0.0",
    author: "SK HABIBULLA",
    countDown: 3,
    role: 2,
    shortDescription: "Instagram GC pending manager",
    longDescription: "Manage Instagram group chat pending requests",
    category: "instagram",
    guide:
      "{pn} list\n" +
      "{pn} accept 1\n" +
      "{pn} accept all\n" +
      "{pn} reject 1\n" +
      "{pn} reject all"
  },

  onStart: async function ({ api, event, args, message }) {
    const reply = text => message.reply(text);

    const action = (args[0] || "list").toLowerCase();
    const target = (args[1] || "").toLowerCase();

    const secret = process.env.HR_GC_API_KEY ||
                   process.env.API_SECRET ||
                   global.config?.HR_GC_API_KEY;

    if (!secret) {
      return reply(
        "❌ API KEY NOT FOUND\n\n" +
        "Set HR_GC_API_KEY in your bot environment."
      );
    }

    async function apiRequest(path, method = "GET", body = null) {
      const response = await fetch(API_URL + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": secret
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        throw new Error(
          result.error || `API Error: HTTP ${response.status}`
        );
      }

      return result.data;
    }

    function getRequests(data) {
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.requests)) return data.requests;
      if (Array.isArray(data?.pending)) return data.pending;
      if (Array.isArray(data?.threads)) return data.threads;
      return [];
    }

    function getId(item) {
      return String(
        item.threadId ||
        item.thread_id ||
        item.id ||
        ""
      );
    }

    function getName(item) {
      return item.name || item.title || "Instagram Group";
    }

    async function loadPending() {
      const data = await apiRequest("/api/gc/pending");
      const requests = getRequests(data);

      global.__HR_PENDING_CACHE[event.threadID] = {
        requests,
        time: Date.now()
      };

      return requests;
    }

    function getCached() {
      const cache = global.__HR_PENDING_CACHE[event.threadID];

      if (!cache || Date.now() - cache.time > CACHE_TTL) {
        return null;
      }

      return cache.requests;
    }

    // PENDING LIST
    if (["list", "pending"].includes(action)) {
      const requests = await loadPending();

      if (!requests.length) {
        return reply(
          "╭━━〔 HR HABIB 〕━━╮\n" +
          "┃ No pending GC requests.\n" +
          "╰━━━━━━━━━━━━━━╯"
        );
      }

      let output =
        "╭━━〔 HR HABIB GC PENDING 〕━━╮\n\n";

      requests.forEach((item, index) => {
        output +=
          `${index + 1}. ${getName(item)}\n` +
          `   ID: ${getId(item) || "Unavailable"}\n\n`;
      });

      output +=
        `Total: ${requests.length}\n\n` +
        "Use: pending accept 1\n" +
        "Use: pending reject 1\n" +
        "╰━━━━━━━━━━━━━━━━━━━━╯";

      return reply(output);
    }

    // ACCEPT / REJECT
    const isAccept = ["accept", "approve"].includes(action);
    const isReject = ["reject", "decline"].includes(action);

    if (!isAccept && !isReject) {
      return reply(
        "HR HABIB GC PENDING\n\n" +
        "pending list\n" +
        "pending accept 1\n" +
        "pending accept all\n" +
        "pending reject 1\n" +
        "pending reject all"
      );
    }

    if (!target) {
      return reply(
        `Usage: pending ${action} 1\n` +
        `Or: pending ${action} all`
      );
    }

    let requests;

    if (target === "all") {
      requests = await loadPending();
    } else {
      requests = getCached();

      if (!requests) {
        return reply(
          "⚠️ Pending list expired.\n" +
          "First run: pending list"
        );
      }
    }

    let selected;

    if (target === "all") {
      selected = requests;
    } else {
      const index = Number(target);

      if (!Number.isInteger(index) || index < 1 ||
          index > requests.length) {
        return reply("❌ Invalid request number.");
      }

      selected = [requests[index - 1]];
    }

    let success = 0;
    let failed = 0;
    const errors = [];

    for (const item of selected) {
      const threadId = getId(item);

      if (!threadId) {
        failed++;
        errors.push("Missing thread ID");
        continue;
      }

      try {
        await apiRequest(
          isAccept ? "/api/gc/approve" : "/api/gc/reject",
          "POST",
          { threadId }
        );

        success++;
      } catch (error) {
        failed++;
        errors.push(`${threadId}: ${error.message}`);
      }

      await sleep(ACTION_DELAY);
    }

    global.__HR_PENDING_CACHE[event.threadID] = null;

    let output =
      "╭━━〔 HR HABIB RESULT 〕━━╮\n" +
      `┃ Action: ${action.toUpperCase()}\n` +
      `┃ Success: ${success}\n` +
      `┃ Failed: ${failed}\n` +
      "╰━━━━━━━━━━━━━━━━━━━━╯";

    if (errors.length) {
      output += "\n\nErrors:\n" +
        errors.slice(0, 5).join("\n");
    }

    return reply(output);
  }
};
