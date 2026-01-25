const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  Events
} = require("discord.js");
const fs = require("fs");
require("dotenv").config();

/* ========= 設定 ========= */

const DATA_FILE = "./data.json";

/*
data.json の中身イメージ
{
  "ignoreUsers": {},
  "logChannels": {},
  "dmMessages": {}
}
*/

let data = {
  ignoreUsers: {},
  logChannels: {},
  dmMessages: {}
};

if (fs.existsSync(DATA_FILE)) {
  data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* ========= Client ========= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction
  ]
});

/* ========= 起動 ========= */

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user.tag}`);
});

/* ========= Embed生成 ========= */

function createEmbed(reaction, user) {
  const msg = reaction.message;
  const jumpUrl = msg.url;

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("リアクション通知")
    .setDescription(
      [
        `**サーバー**: [${msg.guild.name}](https://discord.com/channels/${msg.guild.id})`,
        `**チャンネル**: <#${msg.channel.id}>`,
        `**メッセージ作者**: <@${msg.author.id}>`,
        `**リアクションした人**: <@${user.id}>`,
        `**絵文字**: ${reaction.emoji}`,
        ``,
        `👉 [元メッセージへジャンプ](${jumpUrl})`,
        ``,
        `**内容**: ${msg.content || "（本文なし）"}`
      ].join("\n")
    )
    .setTimestamp();
}

/* ========= リアクション追加 ========= */

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  try {
    if (user.bot) return;

    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const msg = reaction.message;

    // DM無視設定
    if (data.ignoreUsers[msg.author.id]) return;

    const embed = createEmbed(reaction, user);
    const key = `${msg.id}_${reaction.emoji.identifier}_${user.id}`;

    // DM送信（メッセージ作者）
    const dm = await msg.author.send({ embeds: [embed] });
    data.dmMessages[key] = dm.id;

    // ログチャンネル
    const logChannelId = data.logChannels[msg.guildId];
    if (logChannelId) {
      const logChannel = await client.channels.fetch(logChannelId);
      if (logChannel) {
        await logChannel.send({ embeds: [embed] });
      }
    }

    save();
  } catch (err) {
    console.error(err);
  }
});

/* ========= リアクション削除 ========= */

client.on(Events.MessageReactionRemove, async (reaction, user) => {
  try {
    if (user.bot) return;

    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const msg = reaction.message;
    const key = `${msg.id}_${reaction.emoji.identifier}_${user.id}`;
    const dmId = data.dmMessages[key];
    if (!dmId) return;

    const dm = await msg.author.createDM();
    const message = await dm.messages.fetch(dmId);
    await message.delete();

    delete data.dmMessages[key];
    save();
  } catch (err) {
    // DM削除済みなどは無視
  }
});

/* ========= スラッシュコマンド ========= */

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // 管理者限定
  if (
    !interaction.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    )
  ) {
    return interaction.reply({
      content: "❌ 管理者専用コマンドです",
      ephemeral: true
    });
  }

  /* ---- /ignore ---- */
  if (interaction.commandName === "ignore") {
    const mode = interaction.options.getString("mode");

    if (mode === "on") {
      data.ignoreUsers[interaction.user.id] = true;
      save();
      return interaction.reply({
        content: "🔕 DM通知をオフにしました",
        ephemeral: true
      });
    }

    if (mode === "off") {
      delete data.ignoreUsers[interaction.user.id];
      save();
      return interaction.reply({
        content: "🔔 DM通知をオンにしました",
        ephemeral: true
      });
    }
  }

  /* ---- /log ---- */
  if (interaction.commandName === "log") {
    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const channel = interaction.options.getChannel("channel");
      data.logChannels[interaction.guildId] = channel.id;
      save();

      return interaction.reply({
        content: `✅ リアクションログ送信先を ${channel} に設定しました`,
        ephemeral: true
      });
    }

    if (sub === "remove") {
      delete data.logChannels[interaction.guildId];
      save();

      return interaction.reply({
        content: "🗑️ リアクションログを無効化しました",
        ephemeral: true
      });
    }
  }
});

/* ========= ログイン ========= */

client.login(process.env.BOT_TOKEN);
