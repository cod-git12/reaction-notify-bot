require('dotenv').config();
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

].map(c => c.toJSON());

const rest = new REST({ version: "10" })
  .setToken(process.env.REA_BOT_TOKEN);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(
      Routes.applicationCommands("1464782363409252473"), 
      { body: commands }
    );

    console.log("Successfully reloaded application (/) commands.");
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
