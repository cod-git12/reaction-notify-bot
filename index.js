const {
  Client,
  GatewayIntentBits,
  Partials
} = require("discord.js");
const fs = require("fs");

const TOKEN = process.env.REA_BOT_TOKEN;
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
    emoji: "絵文字",
    content: "内容"
  },
  en: {
    reactionTitle: "Reaction Notification",
    jump: "Jump to message",
    none: "(No content)",
    server: "Server",
    channel: "Channel",
    author: "Message author",
    reactor: "Reacted by",
    emoji: "Emoji",
    content: "Content"
  },
  fr: {
    reactionTitle: "Notification de réaction",
    jump: "Aller au message",
    none: "(Aucun contenu)",
    server: "Serveur",
    channel: "Salon",
    author: "Auteur du message",
    reactor: "Réaction par",
    emoji: "Emoji",
    content: "Contenu"
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

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

/* =======================
   リアクション追加
======================= */

client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;

  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const message = reaction.message;
    if (!message.guild) return;

    const guildData = getGuild(message.guild.id);
    if (!guildData.dmNotify) return;

    const lang = T[guildData.language] || T.ja;

    const jumpUrl = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;

    const embed = {
      color: 0x00bfff,
      title: lang.reactionTitle,
      description:
        `👉 **[${lang.jump}](${jumpUrl})**\n\n` +
        `**${lang.content}:**\n${message.content || lang.none}`,
      fields: [
        { name: lang.server, value: message.guild.name },
        { name: lang.channel, value: `<#${message.channel.id}>`, inline: true },
        { name: lang.author, value: `<@${message.author.id}>`, inline: true },
        { name: lang.reactor, value: `<@${user.id}>`, inline: true },
        { name: lang.emoji, value: reaction.emoji.toString(), inline: true }
      ],
      timestamp: new Date()
    };

    await message.author.send({ embeds: [embed] });
  } catch (err) {
    console.error("Reaction notify error:", err);
  }
});

/* =======================
   ログイン
======================= */

client.login(TOKEN);


client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await interaction.reply({
      content: "OK、コマンド受け取った",
      ephemeral: true
    });
  } catch (err) {
    console.error("interaction error:", err);
  }
});
