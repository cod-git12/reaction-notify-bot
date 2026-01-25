const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("ignore")
    .setDescription("リアクション通知のON/OFFを切り替える")
    .addStringOption(option =>
      option
        .setName("mode")
        .setDescription("on = 通知OFF / off = 通知ON")
        .setRequired(true)
        .addChoices(
          { name: "on (通知OFF)", value: "on" },
          { name: "off (通知ON)", value: "off" }
        )
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log("✅️コマンド登録完了");
  } catch (err) {
    console.error(err);
  }
})();
