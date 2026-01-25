const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("ignore")
    .setDescription("DM通知の切り替え / Toggle DM notifications"),

  new SlashCommandBuilder()
    .setName("log")
    .setDescription("リアクションログ設定 / Reaction log settings")
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("ログ送信チャンネルを設定 / Set log channel")
        .addChannelOption(opt =>
          opt.setName("channel").setDescription("チャンネル").setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("ログ送信を無効化 / Disable log channel")
    ),

  new SlashCommandBuilder()
    .setName("language")
    .setDescription("言語設定 / Set language")
    .addStringOption(opt =>
      opt
        .setName("lang")
        .setDescription("Language")
        .setRequired(true)
        .addChoices(
          { name: "日本語", value: "ja" },
          { name: "English", value: "en" },
          { name: "Français", value: "fr" }
        )
    ),

  new SlashCommandBuilder()
    .setName("help")
    .setDescription("ヘルプを表示 / Show help")
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

(async () => {
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
  console.log("Commands deployed.");
})();
