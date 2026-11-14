
const fs = require("fs-extra");
const path = require("path");
const https = require("https");

module.exports = {
  config: {
    name: "help",
    aliases: ["menu", "commands"],
    version: "5.5",
    author: "SK HABIBULLA",
    shortDescription: "HR HABIB Premium Help Menu",
    longDescription: "Compact WhatsApp command menu",
    category: "system",
    guide: "{pn}help [command name]"
  },

  onStart: async function ({ message, args, prefix }) {
    const allCommands = global.GoatBot.commands;

    if (!allCommands) {
      return message.reply("❌ Commands are not available!");
    }

    const line = "━━━━━━━━━━━━━━━━━━━━";

    const categoryEmoji = {
      admin: "👑",
      ai: "🤖",
      "ai-image": "🎨",
      anime: "🎌",
      birthday: "🎂",
      box: "📦",
      "box chat": "👥",
      chat: "💬",
      config: "⚙️",
      "contacts admin": "📞",
      custom: "🛠️",
      economy: "💰",
      fun: "🎭",
      game: "🎮",
      group: "👥",
      image: "🖼️",
      info: "📊",
      information: "📚",
      love: "❤️",
      media: "🎬",
      other: "🌐",
      owner: "🔐",
      rank: "🏆",
      software: "💻",
      supportgc: "🤝",
      system: "⚙️",
      tools: "🧰",
      utility: "🔧",
      wiki: "📖",
      others: "📂"
    };

    const commandEmoji = {
      ban: "🔨",
      kick: "🥾",
      restart: "🔄",
      update: "⬆️",
      eval: "🔐",
      adminonly: "🔒",
      backupdata: "💾",
      welcome: "👋",
      setwelcome: "👋",
      setleave: "🚪",
      download: "📥",
      video: "🎥",
      tiktok: "🎵",
      image: "🖼️",
      weather: "🌤️",
      baby: "🤖",
      help: "📚",
      owner: "👑",
      ping: "⚡",
      balance: "💰",
      daily: "🎁",
      quiz: "❓",
      ffinfo: "🎮"
    };

    // COMMAND DETAILS
    if (args[0]) {
      const cmdName = args[0].toLowerCase();

      const cmd =
        allCommands.get(cmdName) ||
        [...allCommands.values()].find(c =>
          (c.config.aliases || []).some(
            a => a.toLowerCase() === cmdName
          )
        );

      if (!cmd) {
        return message.reply(
`╭━━〔 ❌ COMMAND NOT FOUND 〕━━╮
┃ ✦ Command : ${cmdName}
┃ ✦ Use : ${prefix}help
╰━━━━━━━━━━━━━━━━━━━━╯`
        );
      }

      const cfg = cmd.config;
      const usage = (cfg.guide || "{pn}")
        .replace(/\{pn\}/g, prefix + cfg.name);

      return message.reply(
`╭━━〔 🧩 COMMAND DETAILS 〕━━╮
┃ ✨ NAME : ${cfg.name}
┃ 🔗 ALIAS : ${(cfg.aliases || []).join(", ") || "None"}
┃ 📂 CATEGORY : ${cfg.category || "Others"}
┃ 💎 VERSION : ${cfg.version || "1.0"}
┃ 👑 AUTHOR : ${cfg.author || "Unknown"}
┣━━━━━━━━━━━━━━━━━━━━
┃ 📖 DESCRIPTION
┃ ${cfg.longDescription || cfg.shortDescription || "No description"}
┣━━━━━━━━━━━━━━━━━━━━
┃ ⚡ USAGE
┃ ${usage}
╰━━━━━━━━━━━━━━━━━━━━╯
👑 HR HABIB BOT`
      );
    }

    // GROUP COMMANDS
    const categories = {};

    for (const [name, cmd] of allCommands) {
      const cat = (cmd.config.category || "Others")
        .toLowerCase();

      if (!categories[cat]) {
        categories[cat] = [];
      }

      categories[cat].push(name);
    }

    const categoryNames = Object.keys(categories).sort();

    const totalCommands = allCommands.size;
    const totalCategories = categoryNames.length;

    // MAIN MENU
    let msg =
`╭━━━━〔 🍘 HR HABIB BOT 〕━━━━╮
┃ ✨ WHATSAPP V5.5
┃ 👑 DEVELOPER : SK HABIBULLA
┃ ⚡ PREFIX : ${prefix}
┃ 📚 COMMANDS : ${totalCommands}
┃ 📂 CATEGORIES : ${totalCategories}
╰━━━━━━━━━━━━━━━━━━━━╯

`;

    // CATEGORY MENU
    for (const cat of categoryNames) {
      const commands = categories[cat].sort();
      const emoji = categoryEmoji[cat] || "📁";
      const title = cat.toUpperCase();

      msg +=
`╭━━〔 ${emoji} ${title} 〕━━╮
┃ ✨ ${commands.length} COMMANDS
┣━━━━━━━━━━━━━━━━━━━━
`;

      commands.forEach((name, index) => {
        const icon = commandEmoji[name.toLowerCase()] || "✦";
        const number = String(index + 1).padStart(2, "0");

        msg += `┃ ${number} ┊ ${icon} ${name}\n`;
      });

      msg += "╰━━━━━━━━━━━━━━━━━━━━╯\n\n";
    }

    // FOOTER
    msg +=
`╭━━━━━━━━━━━━━━━━━━━━╮
┃ 📚 TOTAL COMMANDS : ${totalCommands}
┣━━━━━━━━━━━━━━━━━━━━
┃ 📂 TOTAL CATEGORIES : ${totalCategories}
╰━━━━━━━━━━━━━━━━━━━━╯

╭━━〔 💡 COMMAND GUIDE 〕━━╮
┃ ✦ ${prefix}help
┃ ✦ ${prefix}help command
┃ ✦ ${prefix}help category
╰━━━━━━━━━━━━━━━━━━━━╯

👑 DEVELOPER : SK HABIBULLA
❤️ THANK YOU FOR USING HR HABIB BOT`;

    // RANDOM GIF
    const gifURLs = [
      "https://i.imgur.com/Xw6JTfn.gif",
      "https://i.imgur.com/mW0yjZb.gif",
      "https://i.imgur.com/KQBcxOV.gif"
    ];

    const randomGif =
      gifURLs[Math.floor(Math.random() * gifURLs.length)];

    const gifFolder = path.join(__dirname, "cache");
    const gifPath = path.join(
      gifFolder,
      "hr-habib-help.gif"
    );

    try {
      await fs.ensureDir(gifFolder);

      if (!await fs.pathExists(gifPath)) {
        await downloadGif(randomGif, gifPath);
      }

      return message.reply({
        body: msg,
        attachment: fs.createReadStream(gifPath)
      });

    } catch (error) {
      console.error("[HR HABIB HELP ERROR]", error);
      return message.reply(msg);
    }
  }
};

// GIF DOWNLOADER
function downloadGif(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      return reject(new Error("Too many redirects"));
    }

    const file = fs.createWriteStream(dest);

    const cleanup = () => {
      file.destroy();
      fs.remove(dest).catch(() => {});
    };

    const request = https.get(url, {
      headers: {
        "User-Agent": "HR-HABIB-BOT/5.5"
      },
      timeout: 15000
    }, response => {

      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const location = response.headers.location;
        response.resume();
        file.close();

        if (!location) {
          cleanup();
          return reject(new Error("Redirect URL missing"));
        }

        return downloadGif(
          new URL(location, url).href,
          dest,
          redirects + 1
        ).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        response.resume();
        cleanup();
        return reject(new Error("GIF download failed"));
      }

      response.pipe(file);

      file.on("finish", () => {
        file.close(err => {
          if (err) {
            cleanup();
            return reject(err);
          }
          resolve();
        });
      });

      response.on("error", err => {
        cleanup();
        reject(err);
      });

      file.on("error", err => {
        cleanup();
        reject(err);
      });
    });

    request.on("timeout", () => {
      request.destroy(new Error("GIF download timeout"));
    });

    request.on("error", err => {
      cleanup();
      reject(err);
    });
  });
}
