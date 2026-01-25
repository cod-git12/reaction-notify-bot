const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionFlagsBits
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const DATA_FILE = "./reaction-data.json";

// ===== 永続化データ =====
let data = {
  ignoreUsers: {},
  logChannels: {},
  dmMessages: {} // reactionKey → dmMessageId
};

if (fs.existsSync(DATA_FILE)) {
  data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

const save = () => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// ===== ready =====
client.once("clientReady", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// ===== スラッシュコマンド =====
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // /ignore
  if (interaction.commandName === "ignore") {
    const mode = interaction.options.getString("mode");
    const uid = interaction.user.id;

    data.ignoreUsers[uid] = mode === "on";
    save();

    return interaction.reply({
      content: `🔔 通知を **${mode === "on" ? "OFF" : "ON"}** にしました`,
      ephemeral: true
    });
  }

  // /log
  if (interaction.commandName === "log") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: "❌ 管理者専用コマンドです",
        ephemeral: true
      });
    }

    const sub = interaction.options.getSubcommand();
    const gid = interaction.guildId;

    if (sub === "add") {
      const channel = interaction.options.getChannel("channel");
      data.logChannels[gid] = channel.id;
      save();

      return interaction.reply({
        content: `📜 ログ送信先を ${channel} に設定しました`,
        ephemeral: true
      });
    }

    if (sub === "remove") {
      delete data.logChannels[gid];
      save();

      return interaction.reply({
        content: "🗑️ ログ送信を停止しました",
        ephemeral: true
      });
    }
  }
});

// ===== Embed生成 =====
const createEmbed = (reaction, user) => {
  const msg = reaction.message;
  const url = `https://discord.com/channels/${msg.guildId}/${msg.channelId}/${msg.id}`;

  return new EmbedBuilder()
    .setColor(0x00bfff)
    .setTitle("リアクション通知")
    .setDescription(
      `**サーバー**: [${msg.guild.name}](${url})\n` +
      `**ユーザー**: <@${user.id}>\n` +
      `**絵文字**: ${reaction.emoji}\n` +
      `**チャンネル**: <#${msg.channelId}>`
    )
    .setFooter({ text: "クリックで元メッセージへ移動" })
    .setTimestamp();
};

// ===== reaction add =====
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;
  if (data.ignoreUsers[user.id]) return;

  if (reaction.partial) await reaction.fetch();
  const msg = reaction.message;

  if (msg.author.id !== user.id) return;

  const embed = createEmbed(reaction, user);
  const key = `${msg.id}_${reaction.emoji.identifier}_${user.id}`;

  // DM
  const dm = await user.send({ embeds: [embed] });
  data.dmMessages[key] = dm.id;

  // Log
  const logChId = data.logChannels[msg.guildId];
  if (logChId) {
    const ch = await client.channels.fetch(logChId);
    await ch.send({ embeds: [embed] });
  }

  save();
});

// ===== reaction remove =====
client.on("messageReactionRemove", async (reaction, user) => {
  if (reaction.partial) await reaction.fetch();
  const msg = reaction.message;
  const key = `${msg.id}_${reaction.emoji.identifier}_${user.id}`;

  const dmId = data.dmMessages[key];
  if (!dmId) return;

  try {
    const dm = await user.createDM();
    const m = await dm.messages.fetch(dmId);
    await m.delete();
  } catch {}

  delete data.dmMessages[key];
  save();
});

client.login(process.env.TOKEN);
