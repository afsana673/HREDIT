
const fs = require("fs-extra");
const path = require("path");
const https = require("https");

module.exports = {
  config: {
    name: "help",
    aliases: ["menu", "commands"],
    version: "5.0",
    author: "SK HABIBULLA",
    shortDescription: "HR HABIB Premium Help Menu",
    longDescription: "Display all bot commands in HR HABIB premium style",
    category: "system",
    guide: "{pn}help [command name]"
  },

  onStart: async function ({ message, args, prefix }) {
    const allCommands = global.GoatBot.commands;

    const line = "━━━━━━━━━━━━━━━━━━";

    const fancy = (str) =>
      String(str).replace(/[A-Za-z]/g, c => {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
        const fonts = [
          ..."𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙",
          ..."𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳"
        ];
        return fonts[chars.indexOf(c)] || c;
      });

    const categories = {};

    // COMMAND INFORMATION
    if (args[0]) {
      const cmdName = args[0].toLowerCase();

      const cmd =
        allCommands.get(cmdName) ||
        [...allCommands.values()].find(c =>
          c.config.aliases?.includes(cmdName)
        );

      if (!cmd) {
        return message.reply(
`╭━━━〔 ❌ HR HABIB 〕━━━╮
┃
┃  Command Not Found!
┃
┃  Command: ${cmdName}
┃
┃  Use ${prefix}help
┃  To see all commands.
┃
╰━━━━━━━━━━━━━━━━━━╯`
        );
      }

      const usage = typeof cmd.config.guide === "string"
        ? cmd.config.guide.replace("{pn}", prefix + cmd.config.name)
        : prefix + cmd.config.name;

      return message.reply(
`╭━━━〔 🧩 HR HABIB INFO 〕━━━╮
┃
┃  ✦ NAME     : ${cmd.config.name}
┃  ✦ ALIASES  : ${cmd.config.aliases?.join(", ") || "None"}
┃  ✦ CATEGORY : ${cmd.config.category || "Others"}
┃  ✦ VERSION  : v${cmd.config.version || "1.0"}
┃  ✦ AUTHOR   : ${cmd.config.author || "Unknown"}
┃
${line}
┃  📖 DESCRIPTION
┃  ${cmd.config.longDescription ||
     cmd.config.shortDescription || "No description"}
┃
┃  ⚡ USAGE
┃  ${usage}
┃
╰━━━━━━━━━━━━━━━━━━━━╯
       ⚡ POWERED BY HR HABIB`
      );
    }

    // GROUP COMMANDS BY CATEGORY
    for (const [name, cmd] of allCommands) {
      const cat = (cmd.config.category || "Others").toLowerCase();

      if (!categories[cat]) categories[cat] = [];

      categories[cat].push(name);
    }

    // MAIN HELP BODY
    let msg =
`╭━━━━━━━━━━━━━━━━━━━━╮
       👑 HR HABIB BOT
       ✨ COMMAND CENTER
╰━━━━━━━━━━━━━━━━━━━━╯

┏━━━〔 🤖 BOT INFORMATION 〕━━━┓
┃
┃  👑 Developer : SK HABIBULLA
┃  ⚡ Prefix    : ${prefix}
┃  📚 Commands  : ${allCommands.size}
┃  📂 Category  : ${Object.keys(categories).length}
┃  💎 Version   : V5.0
┃
┗━━━━━━━━━━━━━━━━━━━━┛

       ✦ COMMAND DIRECTORY ✦
${line}
`;

    for (const cat of Object.keys(categories).sort()) {
      const commands = categories[cat].sort();

      msg +=
`\n╭━━〔 📁 ${cat.toUpperCase()} 〕━━╮\n`;

      for (let i = 0; i < commands.length; i += 2) {
        const first = commands[i];
        const second = commands[i + 1];

        msg += `┃  ✧ ${fancy(first)}`;

        if (second) msg += `  ✧ ${fancy(second)}`;

        msg += "\n";
      }

      msg += "╰━━━━━━━━━━━━━━━━━━╯\n";
    }

    msg +=
`
╭━━━━━━━━━━━━━━━━━━━━╮
┃
┃  💡 COMMAND GUIDE
┃
┃  ➤ ${prefix}help
┃  ➤ ${prefix}help command
┃
┃  ❤️ THANK YOU FOR USING
┃       HR HABIB BOT
┃
╰━━━━━━━━━━━━━━━━━━━━╯
      © SK HABIBULLA`;

    // RANDOM GIF
    const gifURLs = [
      "https://i.imgur.com/Xw6JTfn.gif",
      "https://i.imgur.com/mW0yjZb.gif",
      "https://i.imgur.com/KQBcxOV.gif"
    ];

    const randomGifURL =
      gifURLs[Math.floor(Math.random() * gifURLs.length)];

    const gifFolder = path.join(__dirname, "cache");

    await fs.ensureDir(gifFolder);

    const gifPath = path.join(
      gifFolder,
      path.basename(randomGifURL)
    );

    try {
      if (!await fs.pathExists(gifPath)) {
        await downloadGif(randomGifURL, gifPath);
      }

      return message.reply({
        body: msg,
        attachment: fs.createReadStream(gifPath)
      });
    } catch (error) {
      console.error("[HR HABIB HELP]", error);

      return message.reply(msg);
    }
  }
};

function downloadGif(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);

    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error("GIF download failed"));
      }

      res.pipe(file);

      file.on("finish", () => {
        file.close(resolve);
      });

      file.on("error", reject);
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
        }
