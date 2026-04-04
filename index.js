require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  EmbedBuilder
} = require("discord.js");
const fs = require("fs");
const express = require("express");

const TOKEN = process.env.REA_BOT_TOKEN;
const UPDATE_CHANNEL_ID = "1456250291627229184";
const DATA_FILE = "./data.json";

let data = { guilds: {}, notifications: {} };
if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!data.notifications) data.notifications = {};
  } catch (e) {
    console.error("data.jsonの読み込みに失敗しました:", e);
  }
}

function saveData() {
  fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), (err) => {
    if (err) console.error("データ保存失敗:", err);
  });
}

function getGuild(gid) {
  if (!data.guilds[gid]) {
    data.guilds[gid] = { language: "ja", dmNotify: true, logChannelId: null };
    saveData();
  }
  return data.guilds[gid];
}

// key: "messageId-emoji-userId"
function notifKey(messageId, emoji, userId) {
  return `${messageId}-${emoji}-${userId}`;
}
function saveNotif(key, dmMsgId, logMsgId) {
  data.notifications[key] = { dmMsgId, logMsgId };
  saveData();
}
function getNotif(key) {
  return data.notifications[key] || null;
}
function deleteNotif(key) {
  delete data.notifications[key];
  saveData();
}

const T = {
  ja: { reactionTitle: "リアクション通知", jump: "元メッセージへジャンプ", none: "（本文なし）", server: "サーバー", channel: "チャンネル", author: "メッセージ作者", reactor: "リアクションした人", emoji: "絵文字", content: "内容" },
  en: { reactionTitle: "Reaction Notification", jump: "Jump to message", none: "(No content)", server: "Server", channel: "Channel", author: "Message author", reactor: "Reacted by", emoji: "Emoji", content: "Content" },
  fr: { reactionTitle: "Notification de réaction", jump: "Aller au message", none: "(Aucun contenu)", server: "Serveur", channel: "Salon", author: "Auteur du message", reactor: "Réaction par", emoji: "Emoji", content: "Contenu" }
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User]
});

client.once("ready", async () => {
  console.log(`✅ ${client.user.tag} オンライン (${client.guilds.cache.size} サーバー)`);

  
  try {
    const channel = await client.channels.fetch(UPDATE_CHANNEL_ID)
    if (channel) {
      channel.send({
        embeds: [
          new EmbedBuilder()
          .setTitle("🚀 Botが起動したよ！")
          .setDescription("Botがアップデートされたよ！")
          .addFields({ name: "起動時刻", value: new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }) })
          .setColor(0x00ff99)
          .setTimestamp()
        ]
      });
    }
  } catch (e) {
    console.error("アップデート通知の送信に失敗:", e)
  }
});

client.on("error", (e) => console.error("Discord client error:", e));
client.on("warn",  (w) => console.warn("Discord client warn:", w));
client.on("shardError", (e) => console.error("Shard error:", e));
process.on("unhandledRejection", (e) => console.error("unhandledRejection:", e));

client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;

  try {
    if (reaction.partial) await reaction.fetch().catch(() => null);
    if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

    const message = reaction.message;
    if (!message.guild) return;

    const guildData = getGuild(message.guild.id);
    const lang = T[guildData.language] || T.ja;
    const jumpUrl = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;
    const authorTag = message.author ? `<@${message.author.id}>` : "不明なユーザー";
    const emojiStr = reaction.emoji.toString();

    const embed = {
      color: 0x00bfff,
      title: lang.reactionTitle,
      description: `👉 **[${lang.jump}](${jumpUrl})**\n\n**${lang.content}:**\n${message.content || lang.none}`,
      fields: [
        { name: lang.server, value: message.guild.name },
        { name: lang.channel, value: `<#${message.channel.id}>`, inline: true },
        { name: lang.author, value: authorTag, inline: true },
        { name: lang.reactor, value: `<@${user.id}>`, inline: true },
        { name: lang.emoji, value: emojiStr, inline: true }
      ],
      timestamp: new Date().toISOString()
    };

    const key = notifKey(message.id, emojiStr, user.id);
    let dmMsgId = null;
    let logMsgId = null;

    if (guildData.dmNotify && message.author) {
      const dmMsg = await message.author.send({ embeds: [embed] }).catch(e => {
        console.log("DM送信失敗:", e.message);
        return null;
      });
      if (dmMsg) dmMsgId = dmMsg.id;
    }

    if (guildData.logChannelId) {
      const logCh = await message.guild.channels.fetch(guildData.logChannelId).catch(() => null);
      if (logCh) {
        const logMsg = await logCh.send({ embeds: [embed] }).catch(e => {
          console.log("ログ送信失敗:", e.message);
          return null;
        });
        if (logMsg) logMsgId = logMsg.id;
      }
    }

    if (dmMsgId || logMsgId) {
      saveNotif(key, dmMsgId, logMsgId);
    }

  } catch (err) {
    console.error("ReactionAdd Error:", err);
  }
});

client.on("messageReactionRemove", async (reaction, user) => {
  if (user.bot) return;

  try {
    if (reaction.partial) await reaction.fetch().catch(() => null);
    if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

    const message = reaction.message;
    if (!message.guild) return;

    const guildData = getGuild(message.guild.id);
    const emojiStr = reaction.emoji.toString();
    const key = notifKey(message.id, emojiStr, user.id);
    const notif = getNotif(key);
    if (!notif) return;

    if (notif.dmMsgId && message.author) {
      const dmChannel = await message.author.createDM().catch(() => null);
      if (dmChannel) {
        await dmChannel.messages.fetch(notif.dmMsgId)
          .then(msg => msg.delete())
          .catch(e => console.log("DM削除失敗:", e.message));
      }
    }

    if (notif.logMsgId && guildData.logChannelId) {
      const logCh = await message.guild.channels.fetch(guildData.logChannelId).catch(() => null);
      if (logCh) {
        await logCh.messages.fetch(notif.logMsgId)
          .then(msg => msg.delete())
          .catch(e => console.log("ログ削除失敗:", e.message));
      }
    }

    deleteNotif(key);

  } catch (err) {
    console.error("ReactionRemove Error:", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  console.log(`[CMD] ${interaction.commandName} by ${interaction.user.tag}`);

  const deferred = await interaction.deferReply({ ephemeral: true }).then(() => true).catch(() => false);
  const reply = async (content) => {
    if (deferred) return interaction.editReply(content).catch(console.error);
    return interaction.reply({ content, ephemeral: true }).catch(console.error);
  };

  try {
    const gid = interaction.guildId;
    const g = getGuild(gid);

    const isAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
    const isOwner = interaction.user.id === "1324865769892352011";

    if (!isAdmin && !isOwner) {
      return reply("❌ このコマンドを実行する権限がありません。");
    }

    if (interaction.commandName === "ignore") {
      g.dmNotify = !g.dmNotify;
      saveData();
      return reply(`DM通知を **${g.dmNotify ? "ON" : "OFF"}** にしました`);
    }

    if (interaction.commandName === "log") {
      const sub = interaction.options.getSubcommand();
      if (sub === "add") {
        const ch = interaction.options.getChannel("channel");
        g.logChannelId = ch.id;
        saveData();
        return reply(`ログ送信チャンネルを <#${ch.id}> に設定しました`);
      }
      if (sub === "remove") {
        g.logChannelId = null;
        saveData();
        return reply("ログ送信を無効化しました");
      }
    }

    if (interaction.commandName === "language") {
      g.language = interaction.options.getString("lang");
      saveData();
      return reply(`言語を **${g.language}** に変更しました`);
    }

  } catch (err) {
    console.error("Interaction Error:", err);
    await reply("内部エラーが発生しました。").catch(() => null);
  }
});

const app = express();
app.get("/", (req, res) => res.send("Bot is alive"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server ready on port ${PORT}`));

console.log("Discord へのログインを試みています...");
console.log("TOKEN 先頭6文字:", TOKEN ? TOKEN.substring(0, 6) : "未設定！！");

const loginTimeout = setTimeout(() => {
  console.error("❌ タイムアウト: 30秒以内にDiscordからreadyイベントが来ませんでした");
}, 30000);

client.once("ready", () => {
  clearTimeout(loginTimeout);
});

client.login(TOKEN).catch((err) => {
  clearTimeout(loginTimeout);
  console.error("❌ client.login() 失敗:", err.message);
});
