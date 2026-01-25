const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

// 通知ON/OFF管理（userId => true/false）
// true = 通知ON, false = 通知OFF
// 初期状態は ON
const notifyState = new Map();

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// /ignore コマンド処理
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "ignore") return;

  const mode = interaction.options.getString("mode");
  const userId = interaction.user.id;

  if (mode === "on") {
    notifyState.set(userId, false);
    await interaction.reply({
      content: "🔕 リアクション通知を **OFF** にしました",
      ephemeral: true
    });
  }

  if (mode === "off") {
    notifyState.set(userId, true);
    await interaction.reply({
      content: "🔔 リアクション通知を **ON** にしました",
      ephemeral: true
    });
  }
});

// リアクション検知
client.on("messageReactionAdd", async (reaction, user) => {
  // Botのリアクションは無視
  if (user.bot) return;

  // partial対策
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return;
    }
  }

  const message = reaction.message;
  const author = message.author;
  if (!author) return;

  // 通知ON/OFF確認（デフォルトON）
  const notify = notifyState.get(author.id) ?? true;
  if (!notify) return;

  // メッセージURL（ジャンプ用）
  const messageUrl = message.guildId
    ? `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`
    : null;

  const embed = new EmbedBuilder()
    .setTitle("📢 リアクション通知")
    .setColor(0x5865F2)
    .setDescription(
      `**サーバー**: ${
        message.guild
          ? `[${message.guild.name}](${messageUrl})`
          : "DM"
      }\n` +
      `**チャンネル**: <#${message.channelId}>\n` +
      `**リアクション**: ${reaction.emoji}\n` +
      `**付けた人**: <@${user.id}>`
    )
    .setTimestamp();

  // 本文がある場合だけ表示
  if (message.content) {
    embed.addFields({
      name: "💬 メッセージ内容",
      value: message.content.slice(0, 1024)
    });
  }

  // フッター
  embed.setFooter({
    text: "クリックで元メッセージへ移動"
  });

  try {
    await author.send({ embeds: [embed] });
  } catch (e) {
    console.error("DM送信失敗", e);
  }
});

client.login(process.env.BOT_TOKEN);
