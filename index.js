const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  SlashCommandBuilder,
  Routes,
  REST
} = require("discord.js");
const fs = require("fs");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

/* ===== 永続データ ===== */
const DATA_FILE = "./reaction-log.json";
let store = {
  logChannels: {}, // guildId -> channelId
  dmMap: {}        // key -> dmMessageId
};

if (fs.existsSync(DATA_FILE)) {
  store = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

const save = () =>
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));

/* ===== コマンド定義 ===== */
const commands = [
  new SlashCommandBuilder()
    .setName("log")
    .setDescription("リアクションログ設定")
    .addSubcommand(sc =>
      sc.setName("add")
        .setDescription("ログ送信チャンネルを設定")
        .addChannelOption(opt =>
          opt.setName("channel")
            .setDescription("ログ送信先")
            .setRequired(true)
        )
    )
    .addSubcommand(sc =>
      sc.setName("remove")
        .setDescription("ログ送信を解除")
    )
].map(c => c.toJSON());

/* ===== コマンド登録 ===== */
client.once("clientReady", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log("Commands registered");
});

/* ===== コマンド処理 ===== */
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (!interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: "管理者専用です", ephemeral: true });
  }

  if (interaction.commandName === "log") {
    const sub = interaction.options.getSubcommand();

    if (sub === "add") {
      const ch = interaction.options.getChannel("channel");
      store.logChannels[interaction.guildId] = ch.id;
      save();
      return interaction.reply(`✅ ログ送信先を ${ch} に設定しました`);
    }

    if (sub === "remove") {
      delete store.logChannels[interaction.guildId];
      save();
      return interaction.reply("🗑 ログ送信を解除しました");
    }
  }
});

/* ===== 共通Embed生成 ===== */
function createEmbed(type, reaction, user) {
  const msg = reaction.message;
  const guild = msg.guild;

  const jumpUrl =
    `https://discord.com/channels/${guild.id}/${msg.channel.id}/${msg.id}`;

  return new EmbedBuilder()
    .setColor(type === "add" ? 0x00ff99 : 0xff5555)
    .setTitle(type === "add" ? "リアクション追加" : "リアクション削除")
    .setDescription("（本文なし）")
    .addFields(
      {
        name: "サーバー",
        value: `[${guild.name}](https://discord.com/channels/${guild.id})`
      },
      {
        name: "ユーザー",
        value: `<@${user.id}>`
      },
      {
        name: "リアクション",
        value: reaction.emoji.toString(),
        inline: true
      },
      {
        name: "元メッセージ",
        value: `[ジャンプする](${jumpUrl})`
      }
    )
    .setTimestamp();
}

/* ===== リアクション追加 ===== */
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();

  const embed = createEmbed("add", reaction, user);

  /* DM送信 */
  const dm = await user.send({ embeds: [embed] }).catch(() => null);
  if (dm) {
    const key =
      `${reaction.message.guildId}_${reaction.message.id}_${user.id}_${reaction.emoji.identifier}`;
    store.dmMap[key] = dm.id;
    save();
  }

  /* ログ送信 */
  const logChId = store.logChannels[reaction.message.guildId];
  if (logChId) {
    const ch = reaction.message.guild.channels.cache.get(logChId);
    ch?.send({ embeds: [embed] });
  }
});

/* ===== リアクション削除 ===== */
client.on("messageReactionRemove", async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();

  const key =
    `${reaction.message.guildId}_${reaction.message.id}_${user.id}_${reaction.emoji.identifier}`;

  /* DM削除 */
  try {
    const dmId = store.dmMap[key];
    if (dmId) {
      const dm = await user.createDM();
      const msg = await dm.messages.fetch(dmId);
      await msg.delete();
      delete store.dmMap[key];
      save();
    }
  } catch {}

  /* ログ送信 */
  const logChId = store.logChannels[reaction.message.guildId];
  if (logChId) {
    const embed = createEmbed("remove", reaction, user);
    const ch = reaction.message.guild.channels.cache.get(logChId);
    ch?.send({ embeds: [embed] });
  }
});

client.login(process.env.TOKEN);
