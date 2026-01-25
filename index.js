const {
  Client,
  GatewayIntentBits,
  Partials
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
const notifyState = new Map();

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// /ignore コマンド
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

  // 初期状態は通知ON
  const notify = notifyState.get(author.id) ?? true;
  if (!notify) return;

  // 自分のメッセージにだけ送る（＝作者本人）
  try {
    await author.send(
      `📢 **リアクション通知**\n` +
      `サーバー: ${message.guild?.name ?? "DM"}\n` +
      `付けた人: ${user.tag}\n` +
      `絵文字: ${reaction.emoji}\n` +
      `内容: ${message.content || "(本文なし)"}`
    );
  } catch (e) {
    console.error("DM送信失敗", e);
  }
});

client.login(process.env.BOT_TOKEN);
