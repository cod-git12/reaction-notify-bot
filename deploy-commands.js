const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("ignore")
    .setDescription("DM通知のオン・オフを切り替え"),

  new SlashCommandBuilder()
    .setName("log")
    .setDescription("リアクションログ設定")
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("ログ送信チャンネルを設定")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("チャンネル").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("remove").setDescription("ログ送信を無効化")
    ),

  new SlashCommandBuilder()
    .setName("language")
    .setDescription("Botの言語を設定")
    .addStringOption(opt =>
      opt
        .setName("lang")
        .setDescription("言語")
        .setRequired(true)
        .addChoices(
          { name: "日本語", value: "ja" },
          { name: "English", value: "en" },
          { name: "Français", value: "fr" }
        )
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    console.log("Deploying commands...");
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log("Done.");
  } catch (e) {
    console.error(e);
  }
})();
