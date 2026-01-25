const {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");
const fs = require("fs");

const TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const DATA_FILE = "./data.json";

/* =======================
   永続データ
======================= */

let data = { guilds: {} };

if (fs.existsSync(DATA_FILE)) {
  data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getGuild(gid) {
  if (!data.guilds[gid]) {
    data.guilds[gid] = {
      language: "ja",
      dmNotify: true,
      logChannelId: null
    };
    saveData();
  }
  return data.guilds[gid];
}

/* =======================
   多言語
======================= */

const T = {
  ja: {
    reactionTitle: "リアクション通知",
    jump: "元メッセージへジャンプ",
    none: "（本文なし）",
    server: "サーバー",
    channel: "チャンネル",
    author: "メッセージ作者",
    reactor: "リアクションした人",
    emoji: "絵文字"
  },
  en: {
    reactionTitle: "Reaction Notification",
    jump: "Jump to message",
    none: "(No content)",
    server: "Server",
    channel: "Channel",
    author: "Message author",
    reactor: "Reacted by",
    emoji: "Emoji"
  },
  fr: {
    reactionTitle: "Notification de réaction",
    jump: "Aller au message",
    none: "(Aucun contenu)",
    server: "Serveur",
    channel: "Salon",
    author: "Auteur du message",
    reactor: "Réaction par",
    emoji: "Emoji"
  }
};

/* =======================
   Client
======================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

/* =======================
   リアクション追加
======================= */

client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) await reaction.fetch();
  const message = await reaction.message.fetch();

  if (!message.guild) return;

  const guildData = getGuild(message.guild.id);
  if (!guildData.dmNotify) return;

  const lang = T[guildData.language];
  const embed = {
    color: 0x00bfff,
    title: lang.reactionTitle,
    fields: [
      { name: lang.server, value: message.guild.name },
      { name: lang.channel, value: message.channel.toString(), inline: true },
      { name: lang.author, value: `<@${message.author.id}>`, inline: true },
      { name: lang.reactor, value: `<@${user.id}>`, inline: true },
      { name: lang.emoji, value: reaction.emoji.toString(), inline: true }
    ],
    description:
      `👉️ [${lang.jump}](${message.url})\n\n` +
      `**内容:**\n${message.content || lang.none}`,
    timestamp: new Date()
  };

  try {
    await message.author.send({ embeds: [embed] });
  } catch {}
});

/* =======================
   ログイン
======================= */

client.login(TOKEN);
