require("dotenv").config();
const { REST, Routes, SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("ignore")
    .setDescription("リアクション通知をON/OFF")
    .addStringOption(option =>
      option
        .setName("mode")
        .setDescription("on=通知OFF / off=通知ON")
        .setRequired(true)
        .addChoices(
          { name: "on (通知OFF)", value: "on" },
          { name: "off (通知ON)", value: "off" }
        )
    ),

  new SlashCommandBuilder()
    .setName("log")
    .setDescription("リアクションログ設定（管理者のみ）")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("ログ送信を有効化")
        .addChannelOption(option =>
          option
            .setName("channel")
            .setDescription("ログ送信先")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("ログ送信を無効化")
    )
].map(c => c.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
  console.log("✅ コマンド登録完了");
})();
