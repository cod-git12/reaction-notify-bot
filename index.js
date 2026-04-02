const {
  Client,
  GatewayIntentBits,
  Partials
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
    GatewayIntentBits.GuildMembers, // 権限チェックに必要
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages, // DM送信に必要
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
  console.log(`参加中のサーバー数: ${client.guilds.cache.size}`);
});

/* =======================
   リアクション通知
======================= */

client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;

  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const message = reaction.message;
    if (!message.guild) return;

    const guildData = getGuild(message.guild.id);
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

    // DM通知
    if (guildData.dmNotify) {
      // ユーザーを明示的にfetchすることでDM送信の成功率を上げます
      const targetUser = await client.users.fetch(message.author.id);
      await targetUser.send({ embeds: [embed] }).catch(err => {
        console.error(`DM送信失敗 (${targetUser.tag}):`, err.message);
      });
    }

    // ログチャンネル通知
    if (guildData.logChannelId) {
      const logCh = await message.guild.channels.fetch(guildData.logChannelId).catch(() => null);
      if (logCh) {
        await logCh.send({ embeds: [embed] }).catch(err => {
          console.error("ログ送信失敗:", err.message);
        });
      }
    }

  } catch (err) {
    console.error("リアクションイベントエラー:", err);
  }
});

/* =======================
   コマンド処理
======================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const gid = interaction.guildId;
    const g = getGuild(gid);

    // 管理者権限を持っているか、あなた（1324865769892352011）であれば許可
    const isAdmin = interaction.member?.permissions.has("Administrator");
    const isOwner = interaction.user.id === "1324865769892352011";

    if (!isAdmin && !isOwner) {
      return interaction.reply({
        content: "❌ このコマンドを実行する権限がありません。",
        ephemeral: true
      });
    }

    if (interaction.commandName === "ignore") {
      g.dmNotify = !g.dmNotify;
      saveData();
      await interaction.reply({
        content: `DM通知を **${g.dmNotify ? "ON" : "OFF"}** にしました`,
        ephemeral: true
      });
    }

    if (interaction.commandName === "log") {
      const sub = interaction.options.getSubcommand();
      if (sub === "add") {
        const ch = interaction.options.getChannel("channel");
        g.logChannelId = ch.id;
        saveData();
        await interaction.reply({
          content: `ログ送信チャンネルを <#${ch.id}> に設定しました`,
          ephemeral: true
        });
      } else if (sub === "remove") {
        g.logChannelId = null;
        saveData();
        await interaction.reply({
          content: "ログ送信を無効化しました",
          ephemeral: true
        });
      }
    }

    if (interaction.commandName === "language") {
      g.language = interaction.options.getString("lang");
      saveData();
      await interaction.reply({
        content: `言語を **${g.language}** に変更しました`,
        ephemeral: true
      });
    }

    if (interaction.commandName === "update") {
      const msg = interaction.options.getString("text");
      const ch = await client.channels.fetch(UPDATE_CHANNEL_ID).catch(() => null);
      if (ch) {
        await ch.send({
          embeds: [{
            title: "📢 アップデート通知",
            description: msg,
            color: 0x00ff99,
            timestamp: new Date()
          }]
        });
        await interaction.reply({ content: "アップデート通知を送信しました", ephemeral: true });
      } else {
        await interaction.reply({ content: "通知チャンネルが見つかりませんでした", ephemeral: true });
      }
    }
  } catch (err) {
    console.error("コマンド実行エラー:", err);
    if (!interaction.replied) {
      await interaction.reply({ content: "エラーが発生しました", ephemeral: true });
    }
  }
});

client.login(TOKEN);

const app = express();
app.get("/", (req, res) => res.send("Bot is alive"));
app.listen(process.env.PORT || 3000);
