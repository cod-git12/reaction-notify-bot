const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");
const fs = require("fs");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

/* ===== 永続データ ===== */
const DATA_FILE = "./data.json";
let data = { ignore: {}, logChannels: {}, languages: {} };

if (fs.existsSync(DATA_FILE)) {
  data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}
const save = () =>
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

/* ===== 多言語 ===== */
const TEXT = {
  ja: {
    reactionAdd: "リアクションが追加されました",
    reactionRemove: "リアクションが削除されました",
    dmOn: "🔔 DM通知をオンにしました",
    dmOff: "🔕 DM通知をオフにしました",
    jump: "メッセージへジャンプ",
    updated: "✅ 設定を更新しました",
    adminOnly: "❌ 管理者のみ実行できます"
  },
  en: {
    reactionAdd: "Reaction added",
    reactionRemove: "Reaction removed",
    dmOn: "🔔 DM notifications enabled",
    dmOff: "🔕 DM notifications disabled",
    jump: "Jump to message",
    updated: "✅ Settings updated",
    adminOnly: "❌ Administrator only"
  },
  fr: {
    reactionAdd: "Réaction ajoutée",
    reactionRemove: "Réaction supprimée",
    dmOn: "🔔 Notifications DM activées",
    dmOff: "🔕 Notifications DM désactivées",
    jump: "Aller au message",
    updated: "✅ Paramètres mis à jour",
    adminOnly: "❌ Administrateur uniquement"
  }
};

const langOf = gid => data.languages[gid] || "ja";
const t = (gid, key) => TEXT[langOf(gid)][key] || TEXT.ja[key];

/* ===== Ready ===== */
client.once("clientReady", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* ===== Slash Commands ===== */
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  if (
    !i.memberPermissions?.has(PermissionFlagsBits.Administrator)
  ) {
    return i.reply({ content: t(i.guildId, "adminOnly"), ephemeral: true });
  }

  /* /ignore */
  if (i.commandName === "ignore") {
    const uid = i.user.id;
    data.ignore[uid] = !data.ignore[uid];
    save();

    const embed = new EmbedBuilder().setDescription(
      data.ignore[uid] ? t(i.guildId, "dmOff") : t(i.guildId, "dmOn")
    );

    try { await i.user.send({ embeds: [embed] }); } catch {}

    const logCh = data.logChannels[i.guildId];
    if (logCh) {
      const ch = i.guild.channels.cache.get(logCh);
      if (ch) ch.send({ content: `<@${uid}>`, embeds: [embed] });
    }

    return i.reply({ content: t(i.guildId, "updated"), ephemeral: true });
  }

  /* /log */
  if (i.commandName === "log") {
    const sub = i.options.getSubcommand();
    if (sub === "add") {
      const ch = i.options.getChannel("channel");
      data.logChannels[i.guildId] = ch.id;
      save();
      return i.reply(`✅ ${ch} にログを送信します`);
    }
    if (sub === "remove") {
      delete data.logChannels[i.guildId];
      save();
      return i.reply("🗑️ ログを無効化しました");
    }
  }

  /* /language */
  if (i.commandName === "language") {
    const lang = i.options.getString("lang");
    data.languages[i.guildId] = lang;
    save();
    return i.reply(`🌐 言語を **${lang}** に設定しました`);
  }
});

/* ===== Reaction Add / Remove ===== */
async function notify(reaction, user, added) {
  if (user.bot) return;
  if (data.ignore[user.id]) return;

  const msg = reaction.message;
  const link = `https://discord.com/channels/${msg.guildId}/${msg.channelId}/${msg.id}`;

  const embed = new EmbedBuilder()
    .setTitle(
      added ? t(msg.guildId, "reactionAdd") : t(msg.guildId, "reactionRemove")
    )
    .setDescription(
      `**${t(msg.guildId, "jump")}**\n[${t(msg.guildId, "jump")}](${link})`
    );

  try { await msg.author.send({ embeds: [embed] }); } catch {}

  const logCh = data.logChannels[msg.guildId];
  if (logCh) {
    const ch = msg.guild.channels.cache.get(logCh);
    if (ch) ch.send({ embeds: [embed] });
  }
}

client.on("messageReactionAdd", (r, u) => notify(r, u, true));
client.on("messageReactionRemove", (r, u) => notify(r, u, false));

client.login(process.env.BOT_TOKEN);
