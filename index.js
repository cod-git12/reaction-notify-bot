const { Client, GatewayIntentBits, Partials, PermissionsBitField, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const express = require("express");

const TOKEN = process.env.REA_BOT_TOKEN;
const UPDATE_CHANNEL_ID = "1453677204301942826";
const DATA_FILE = "./data.json";

/* === 永続データ === */
let data = { guilds: {} };
if (fs.existsSync(DATA_FILE)) {
  try { data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch (e) { console.error(e); }
}

const saveData = () => fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), (err) => err && console.error(err));

const getGuild = (gid) => {
  if (!data.guilds[gid]) {
    data.guilds[gid] = { language: "ja", dmNotify: true, logChannelId: null };
    saveData();
  }
  return data.guilds[gid];
};

/* === 多言語設定 === */
const T = {
  ja: { reactionTitle: "リアクション通知", jump: "元メッセージへジャンプ", none: "（本文なし）", server: "サーバー", channel: "チャンネル", author: "メッセージ作者", reactor: "リアクションした人", emoji: "絵文字", content: "内容" },
  en: { reactionTitle: "Reaction Notification", jump: "Jump to message", none: "(No content)", server: "Server", channel: "Channel", author: "Message author", reactor: "Reacted by", emoji: "Emoji", content: "Content" },
  fr: { reactionTitle: "Notification de réaction", jump: "Aller au message", none: "(Aucun contenu)", server: "Serveur", channel: "Salon", author: "Auteur du message", reactor: "Réaction par", emoji: "Emoji", content: "Contenu" }
};

/* === Client設定 === */
const client = new Client({
  intents: [1, 2, 512, 1024, 4096, 32768], // Guilds, Members, Messages, Reactions, DM, MessageContent
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.once("ready", () => console.log(`✅ ${client.user.tag} オンライン (${client.guilds.cache.size} サーバー)`));

/* === リアクション処理 === */
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;
  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();
    const msg = reaction.message;
    if (!msg.guild) return;

    const g = getGuild(msg.guild.id);
    const lang = T[g.language] || T.ja;
    const url = `https://discord.com/channels/${msg.guild.id}/${msg.channel.id}/${msg.id}`;

    const embed = {
      color: 0x00bfff,
      title: lang.reactionTitle,
      description: `👉 **[${lang.jump}](${url})**\n\n**${lang.content}:**\n${msg.content || lang.none}`,
      fields: [
        { name: lang.server, value: msg.guild.name },
        { name: lang.channel, value: `<#${msg.channel.id}>`, inline: true },
        { name: lang.author, value: `<@${msg.author?.id}>`, inline: true },
        { name: lang.reactor, value: `<@${user.id}>`, inline: true },
        { name: lang.emoji, value: reaction.emoji.toString(), inline: true }
      ],
      timestamp: new Date()
    };

    if (g.dmNotify && msg.author) await msg.author.send({ embeds: [embed] }).catch(() => {});
    if (g.logChannelId) {
      const ch = await msg.guild.channels.fetch(g.logChannelId).catch(() => null);
      if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (err) { console.error(err); }
});

/* === コマンド処理 === */
client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  // ★ 3秒ルール対策：即座に応答を予約
  await i.deferReply({ ephemeral: true }).catch(() => null);

  try {
    const g = getGuild(i.guildId);
    if (!i.memberPermissions?.has(PermissionsBitField.Flags.Administrator) && i.user.id !== "1324865769892352011") {
      return i.editReply("❌ 権限がありません。");
    }

    if (i.commandName === "ignore") {
      g.dmNotify = !g.dmNotify;
      saveData();
      return i.editReply(`DM通知を **${g.dmNotify ? "ON" : "OFF"}** にしました`);
    }

    if (i.commandName === "log") {
      const sub = i.options.getSubcommand();
      g.logChannelId = sub === "add" ? i.options.getChannel("channel").id : null;
      saveData();
      return i.editReply(sub === "add" ? `ログ送信先を <#${g.logChannelId}> に設定しました` : "ログ送信を無効化しました");
    }

    if (i.commandName === "language") {
      g.language = i.options.getString("lang");
      saveData();
      return i.editReply(`言語を **${g.language}** に変更しました`);
    }

    if (i.commandName === "update") {
      const ch = await client.channels.fetch(UPDATE_CHANNEL_ID).catch(() => null);
      if (ch) await ch.send({ embeds: [{ title: "📢 アップデート", description: i.options.getString("text"), color: 0x00ff99, timestamp: new Date() }] });
      return i.editReply(ch ? "送信完了" : "チャンネル不明");
    }
  } catch (err) {
    console.error(err);
    await i.editReply("エラーが発生しました。").catch(() => null);
  }
});

client.login(TOKEN);
express().get("/", (r, s) => s.send("Bot alive")).listen(process.env.PORT || 3000);
