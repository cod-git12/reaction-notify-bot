const { REST, Routes, SlashCommandBuilder, ChannelType } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("ignore")
    .setDescription("リアクション通知のON/OFF")
    .addStringOption(option =>
      option
        .setName("mode")
        .setDescription("on = 通知OFF / off = 通知ON")
        .setRequired(true)
        .addChoices(
          { name: "on (通知OFF)", value: "on" },
          { name: "off (通知ON)", value: "off" }
        )
    ),

  new SlashCommandBuilder()
    .setName("log")
    .setDescription("リアクションログの送信先を設定")
    .addSubcommand(sub =>
      sub
        .setName("add")
        .setDescription("ログ送信を有効化")
        .addChannelOption(option =>
          option
            .setName("channel")
            .setDescription("ログを送信するチャンネル")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName("remove")
        .setDescription("ログ送信を無効化")
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

(async () => {
  await rest.put(
    Routes.applicationCommands(process.env.CLIENT_ID),
    { body: commands }
  );
  console.log("✅ コマンド登録完了");
})();
