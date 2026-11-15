
module.exports = {
  config: {
    name: "checkpending",
    version: "1.0",
    author: "SK HABIBULLA",
    role: 2,
    shortDescription: "Check pending API methods",
    category: "admin"
  },

  onStart: async function ({ api, message }) {
    const methods = Object.keys(
      Object.getPrototypeOf(api) || {}
    );

    const ownMethods = Object.keys(api);

    const all = [...new Set([...methods, ...ownMethods])];

    const found = all.filter(name =>
      /group|thread|invite|request|pending|friend|inbox/i.test(name)
    );

    return message.reply(
      "🔍 HR HABIB API INSPECTOR\n\n" +
      "Package: @eryxenx/insta-chat\n\n" +
      (found.length
        ? found.map(x => "✓ " + x).join("\n")
        : "No matching API methods found.")
    );
  }
};
