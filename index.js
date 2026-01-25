const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");
const fs = require("fs");

/* ===== Client ===== */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

/* ===== Data ===== */
const FILE = "./data.json";
let data = {
  ignore: {},
  logChannels: {},
  languages: { guild: {}, user: {} }
};

if (fs.existsSync(FILE)) {
  data = JSON.parse(fs.readFileSync(FILE, "utf8"));
}
const save = () =>
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));

/* ===== Language ===== */
const TEXT = {
  ja: {
    dmOn: "🔔 DM通知をオンにしました",
    dmOff: "🔕 DM通知をオフにしました",
    reactionAdd: "リアクションが追加されました",
    reactionRemove: "リアクションが削除されました",
    jump: "メッセージへジャンプ",
    updated: "✅ 設定を更新しました",
    adminOnly: "❌ 管理者のみ実行できます",
    languageSet: "🌐 言語を **{lang}** に変更しました",
    helpTitle: "ヘルプ",
    helpDesc:
      "/ignore : DM通知の切り替え\n" +
      "/log add : ログ送信チャンネル設定\n" +
      "/log remove : ログ無効化\n" +
      "/language : 言語設定\n" +
      "/help : このヘルプを表示"
  },
  en: {
    dmOn: "🔔 DM notifications enabled",
    dmOff: "🔕 DM notifications disabled",
    reactionAdd: "Reaction added",
    reactionRemove: "Reaction removed",
    jump: "Jump to message",
    updated: "✅ Settings updated",
    adminOnly: "❌ Administrator only",
    languageSet: "🌐 Language set to **{lang}**",
    helpTitle: "Help",
    helpDesc:
      "/ignore : Toggle DM notifications\n" +
      "/log add : Set log channel\n" +
      "/log remove : Disable log\n" +
      "/language : Set language\n" +
      "/help : Show this help"
  },
  fr: {
    dmOn: "🔔 Notifications DM activées",
    dmOff: "🔕 Notifications DM désactivées",
    reactionAdd: "Réaction ajoutée",
    reactionRemove: "Réaction supprimée",
    jump: "Aller au message",
    updated: "✅ Paramètres mis à jour",
    adminOnly: "❌ Administrateur uniquement",
    languageSet: "🌐 Langue définie sur **{lang}**",
    helpTitle: "Aide",
    helpDesc:
      "/ignore : Activer/désactiver les DM\n" +
      "/log add : Définir le salon de logs\n" +
      "/log remove : Désactiver les logs\n" +
      "/language : Changer la langue\n" +
      "/help : Afficher l'aide"
  }
};

function getLang({ guildId, userId }) {
  if (!guildId) return data.languages.user[userId] || "ja";
  return data.languages.guild[guildId] || "ja";
}

function t(ctx, key, vars = {}) {
  let str = TEXT[getLang(ctx)][key] || TEXT.ja[key];
  for (const k in vars) str = str.replace(`{${k}}`, vars[k]);
  return str;
}

/* ===== Ready ===== */
client.once("clientReady", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

/* ===== Commands ===== */
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  const ctx = { guildId: i.guildId, userId: i.user.id };

  /* /ignore */
  if (i.commandName === "ignore") {
    if (i.guildId &&
        !i.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return i.reply({ content: t(ctx, "adminOnly"), ephemeral: true });
    }

    data.ignore[i.user.id] = !data.ignore[i.user.id];
    save();

    const embed = new EmbedBuilder().setDescription(
      data.ignore[i.user.id] ? t(ctx, "dmOff") : t(ctx, "dmOn")
    );

    try { await i.user.send({ embeds: [embed] }); } catch {}

    if (i.guildId && data.logChannels[i.guildId]) {
      const ch = i.guild.channels.cache.get(data.logChannels[i.guildId]);
      if (ch) ch.send({ content: `<@${i.user.id}>`, embeds: [embed] });
    }

    return i.reply({ content: t(ctx, "updated"), ephemeral: true });
  }

  /* /log */
  if (i.commandName === "log") {
    if (!i.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return i.reply({ content: t(ctx, "adminOnly"), ephemeral: true });
    }

    const sub = i.options.getSubcommand();
    if (sub === "add") {
      const ch = i.options.getChannel("channel");
      data.logChannels[i.guildId] = ch.id;
      save();
      return i.reply(`✅ ${ch}`);
    }
    if (sub === "remove") {
      delete data.logChannels[i.guildId];
      save();
      return i.reply("🗑️ OK");
    }
  }

  /* /language */
  if (i.commandName === "language") {
    const lang = i.options.getString("lang");

    if (i.guildId) {
      if (!i.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        return i.reply({ content: t(ctx, "adminOnly"), ephemeral: true });
      }
      data.languages.guild[i.guildId] = lang;
    } else {
      data.languages.user[i.user.id] = lang;
    }

    save();
    return i.reply(t(ctx, "languageSet", { lang }));
  }

  /* /help */
  if (i.commandName === "help") {
    const embed = new EmbedBuilder()
      .setTitle(t(ctx, "helpTitle"))
      .setDescription(t(ctx, "helpDesc"));
    return i.reply({ embeds: [embed], ephemeral: true });
  }
});

/* ===== Reactions ===== */
async function notify(reaction, user, added) {
  if (user.bot) return;
  if (data.ignore[user.id]) return;

  const msg = reaction.message;
  const ctx = { guildId: msg.guildId, userId: msg.author.id };
  const link = `https://discord.com/channels/${msg.guildId}/${msg.channelId}/${msg.id}`;

  const embed = new EmbedBuilder()
    .setTitle(
      added ? t(ctx, "reactionAdd") : t(ctx, "reactionRemove")
    )
    .setDescription(`[${t(ctx, "jump")}](${link})`);

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
