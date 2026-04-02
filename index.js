const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField
} = require("discord.js");
const fs = require("fs");
const express = require("express");

const TOKEN = process.env.REA_BOT_TOKEN;
const UPDATE_CHANNEL_ID = "1453677204301942826";
const DATA_FILE = "./data.json";

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

client.once("ready", () => {
  console.log(`✅ ${client.user.tag} オンライン (${client.guilds.cache.size} サーバー)`);
});

client.on("error", (e) => console.error("Discord client error:", e));
client.on("warn",  (w) => console.warn("Discord client warn:", w));
client.on("disconnect", () => console.error("Discord: 切断されました"));
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
      timestamp: new Date().toISOString()
    };

    if (guildData.dmNotify && message.author) {
      await message.author.send({ embeds: [embed] }).catch(e => console.log("DM送信失敗:", e.message));
    }

    if (guildData.logChannelId) {
      const logCh = await message.guild.channels.fetch(guildData.logChannelId).catch(() => null);
      if (logCh) await logCh.send({ embeds: [embed] }).catch(e => console.log("ログ送信失敗:", e.message));
    }

  } catch (err) {
    console.error("Reaction Error:", err);
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

    if (interaction.commandName === "update") {
      const msg = interaction.options.getString("text");
      const ch = await client.channels.fetch(UPDATE_CHANNEL_ID).catch(() => null);
      if (ch) {
        await ch.send({
          embeds: [{
            title: "📢 アップデート通知",
            description: msg,
            color: 0x00ff99,
            timestamp: new Date().toISOString()
          }]
        }).catch(() => null);
        return reply("アップデート通知を送信しました");
      }
      return reply("通知チャンネルが見つかりませんでした");
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
console.log("TOKEN 先頭6文字:", TOKEN ? TOKEN.substring(0, 6) : "未設定");

client.login(TOKEN).catch((err) => {
  console.error("❌ client.login() 失敗:", err.message);
  console.error("原因: トークンが無効か、Discordに接続できません");
});
