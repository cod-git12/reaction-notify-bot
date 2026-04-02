const {
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("ignore")
    .setDescription("DM通知の切り替え"),

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
      sub
        .setName("remove")
        .setDescription("ログ送信を無効化")
    ),

  new SlashCommandBuilder()
    .setName("language")
    .setDescription("言語設定")
    .addStringOption(opt =>
      opt
        .setName("lang")
        .setDescription("使用する言語を選択してください")
        .setRequired(true)
        .addChoices(
          { name: "日本語", value: "ja" },
          { name: "English", value: "en" },
          { name: "Français", value: "fr" }
        )
    ),

  new SlashCommandBuilder()
    .setName("update")
    .setDescription("アップデート通知を送信")
    .addStringOption(opt =>
      opt
        .setName("text")
        .setDescription("通知内容")
        .setRequired(true)
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" })
  .setToken(process.env.REA_BOT_TOKEN);

(async () => {
  await rest.put(
    Routes.applicationCommands(process.env.REA_CLIENT_ID),
    { body: commands }
  );
  console.log("Commands deployed.");
})();
