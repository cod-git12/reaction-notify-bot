const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField
} = require("discord.js");
const fs = require("fs");
const express = require("express");

/* =======================
   環境変数
======================= */
const TOKEN = process.env.REA_BOT_TOKEN;
const UPDATE_CHANNEL_ID = "1453677204301942826";
const DATA_FILE = "./data.json";

/* =======================
   永続データ
======================= */
let data = { guilds: {} };
if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
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

/* =======================
   多言語
======================= */
const T = {
  ja: { reactionTitle: "リアクション通知", jump: "元メッセージへジャンプ", none: "（本文なし）", server: "サーバー", channel: "チャンネル", author: "メッセージ作者", reactor: "リアクションした人", emoji: "絵文字", content: "内容" },
  en: { reactionTitle: "Reaction Notification", jump: "Jump to message", none: "(No content)", server: "Server", channel: "Channel", author: "Message author", reactor: "Reacted by", emoji: "Emoji", content: "Content" },
  fr: { reactionTitle: "Notification de réaction", jump: "Aller au message", none: "(Aucun contenu)", server: "Serveur", channel: "Salon", author: "Auteur du message", reactor: "Réaction par", emoji: "Emoji", content: "Contenu" }
};

/* =======================
   Client (インテントを数値で確実に指定)
======================= */
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

client.once("ready", () => {
  console.log(`✅ ${client.user.tag} オンライン (${client.guilds.cache.size} サーバー)`);
});

// エラーログの可視化
client.on("error", console.error);
process.on("unhandledRejection", console.error);

/* =======================
   リアクション通知
======================= */
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;

  try {
    // データの完全取得 (fetch) を確実に行う
    if (reaction.partial) await reaction.fetch().catch(() => null);
    if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

    const message = reaction.message;
    if (!message.guild) return;

    const guildData = getGuild(message.guild.id);
    const lang = T[guildData.language] || T.ja;
    const jumpUrl = `https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`;

    // message.author が null の場合の対策
    const authorTag = message.author ? `<@${message.author.id}>` : "不明なユーザー";

    const embed = {
      color: 0x00bfff,
      title: lang.reactionTitle,
      description: `👉 **[${lang.jump}](${jumpUrl})**\n\n**${lang.content}:**\n${message.content || lang.none}`,
      fields: [
        { name: lang.server, value: message.guild.name },
        { name: lang.channel, value: `<#${message.channel.id}>`, inline: true },
        { name: lang.author, value: authorTag, inline: true },
        { name: lang.reactor, value: `<@${user.id}>`, inline: true },
        { name: lang.emoji, value: reaction.emoji.toString(), inline: true }
      ],
      timestamp: new Date()
    };

    // DM通知
    if (guildData.dmNotify && message.author) {
      await message.author.send({ embeds: [embed] }).catch(e => console.log("DM送信失敗:", e.message));
    }

    // ログチャンネル通知 (cache.get ではなく fetch を使う)
    if (guildData.logChannelId) {
      const logCh = await message.guild.channels.fetch(guildData.logChannelId).catch(() => null);
      if (logCh) await logCh.send({ embeds: [embed] }).catch(e => console.log("ログ送信失敗:", e.message));
    }

  } catch (err) {
    console.error("Reaction Error:", err);
  }
});

/* =======================
   コマンド処理
======================= */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // 「応答しませんでした」を防ぐため、即座に返信予約
  await interaction.deferReply({ ephemeral: true }).catch(() => null);

  try {
    const gid = interaction.guildId;
    const g = getGuild(gid);

    // 権限チェック
    const isAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);
    const isOwner = interaction.user.id === "1324865769892352011";

    if (!isAdmin && !isOwner) {
      return interaction.editReply("❌ このコマンドを実行する権限がありません。");
    }

    if (interaction.commandName === "ignore") {
      g.dmNotify = !g.dmNotify;
      saveData();
      return interaction.editReply(`DM通知を **${g.dmNotify ? "ON" : "OFF"}** にしました`);
    }

    if (interaction.commandName === "log") {
      const sub = interaction.options.getSubcommand();
      if (sub === "add") {
        const ch = interaction.options.getChannel("channel");
        g.logChannelId = ch.id;
        saveData();
        return interaction.editReply(`ログ送信チャンネルを <#${ch.id}> に設定しました`);
      }
      if (sub === "remove") {
        g.logChannelId = null;
        saveData();
        return interaction.editReply("ログ送信を無効化しました");
      }
    }

    if (interaction.commandName === "language") {
      g.language = interaction.options.getString("lang");
      saveData();
      return interaction.editReply(`言語を **${g.language}** に変更しました`);
    }

    if (interaction.commandName === "update") {
      const msg = interaction.options.getString("text");
      const ch = await client.channels.fetch(UPDATE_CHANNEL_ID).catch(() => null);
      if (ch) {
        await ch.send({
          embed: { title: "📢 アップデート通知", description: msg, color: 0x00ff99, timestamp: new Date() }
        }).catch(() => null);
        return interaction.editReply("アップデート通知を送信しました");
      }
      return interaction.editReply("通知チャンネルが見つかりませんでした");
    }
  } catch (err) {
    console.error("Interaction Error:", err);
    await interaction.editReply("内部エラーが発生しました。").catch(() => null);
  }
});

client.login(TOKEN);

/* =======================
   Express
======================= */
const app = express();
app.get("/", (req, res) => res.send("Bot is alive"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server ready on port ${PORT}`));
