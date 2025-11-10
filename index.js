const fs = require('fs');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

// 🛡️ CONFIGURACIÓN PRINCIPAL
const ADMINS = [
  '56964187120@c.us',
  '56923856692@c.us',
  '56937386107@c.us',
  '56983043075@c.us'
];

// LINKS DE GRUPOS
const CHAT_GROUP = 'https://chat.whatsapp.com/Jiv6KOGMqpODXdxzJE1uEt';
const ADMIN_GROUP = 'https://chat.whatsapp.com/GkLpKBrptHDFPLGIbYooxa';

// 📂 BASE DE DATOS
const DATA_FILE = './data.json';
let db = { warnings: {}, bans: {}, giveaways: {} };
if (fs.existsSync(DATA_FILE)) db = JSON.parse(fs.readFileSync(DATA_FILE));

function saveDB() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

// 🤖 INICIALIZACIÓN DEL BOT
const client = new Client({ authStrategy: new LocalAuth() });

client.on('qr', qr => qrcode.generate(qr, { small: true }));
client.on('ready', () => console.log('✅ Bot de WhatsApp estilo Discord conectado.'));

// 🔧 FUNCIONES AUXILIARES
const isAdmin = (id) => ADMINS.includes(id);
const toId = (num) => (num.includes('@') ? num : `${num}@c.us`);

async function sendLog(to, msg) {
  const chats = await client.getChats();
  const chat = chats.find(c => c.name.toLowerCase().includes(to.toLowerCase()));
  if (chat) await chat.sendMessage(msg);
}

// 🕐 AUTO DESBANEO
setInterval(() => {
  const now = Date.now();
  for (let user in db.bans) {
    if (db.bans[user].expires && now >= db.bans[user].expires) {
      delete db.bans[user];
      saveDB();
      sendLog("Admin", `⚠️ El tiempo de ban para @${user.replace('@c.us', '')} ha terminado.`, { mentions: [user] });
    }
  }
}, 60000);

// 📜 MANEJO DE COMANDOS
client.on('message', async msg => {
  if (!msg.body.startsWith('/')) return;
  const sender = msg.from.endsWith('@g.us') ? msg.author : msg.from;
  const args = msg.body.split(' ');
  const cmd = args[0].toLowerCase();

  if (!isAdmin(sender))
    return msg.reply('🚫 No tienes permisos para usar los comandos del bot.');

  // 📌 /ban @user [horas] [motivo]
  if (cmd === '/ban') {
    const mention = msg.mentionedIds[0];
    const time = parseInt(args[2]) || 0;
    const reason = args.slice(3).join(' ') || 'No especificado';
    if (!mention) return msg.reply('Debes mencionar a alguien para banear.');

    const duration = time * 60 * 60 * 1000; // horas → ms
    const expires = time > 0 ? Date.now() + duration : null;
    db.bans[mention] = { reason, expires };
    saveDB();

    const log = `👤 Usuario: @${mention.replace('@c.us', '')}\n📌 Motivo: ${reason}\n🕒 Sanción aplicada: ${time} hora(s)\n👮 Admin responsable: Bot`;
    sendLog("Chat", log);
    msg.reply(`✅ Usuario baneado por ${time} hora(s).`);
  }

  // 📌 /kick @user [motivo]
  if (cmd === '/kick') {
    const mention = msg.mentionedIds[0];
    const reason = args.slice(2).join(' ') || 'No especificado';
    if (!mention) return msg.reply('Debes mencionar a alguien para kickear.');

    const log = `👤 Usuario: @${mention.replace('@c.us', '')}\n📌 Motivo: ${reason}\n🕒 Sanción aplicada: Kick\n👮 Admin responsable: Bot`;
    sendLog("Chat", log);
    msg.reply(`🚪 Usuario kickeado correctamente.`);
  }

  // 📌 /warn @user [motivo]
  if (cmd === '/warn') {
    const mention = msg.mentionedIds[0];
    const reason = args.slice(2).join(' ') || 'No especificado';
    if (!mention) return msg.reply('Debes mencionar a alguien para advertir.');
    if (!db.warnings[mention]) db.warnings[mention] = [];
    db.warnings[mention].push({ reason, date: Date.now() });
    saveDB();

    msg.reply(`⚠️ Advertencia enviada a @${mention.replace('@c.us', '')}.`);
  }

  // 🎁 /giveaway [premio] [duración(min)]
  if (cmd === '/giveaway') {
    const prize = args.slice(1, -1).join(' ');
    const duration = parseInt(args[args.length - 1]) * 60000;
    if (!prize || isNaN(duration)) return msg.reply('Uso: /giveaway [premio] [duración en minutos]');

    const giveawayId = Date.now().toString();
    db.giveaways[giveawayId] = { prize, participants: [], ends: Date.now() + duration };
    saveDB();

    const message = await msg.reply(`🎉 ¡Giveaway iniciado!\n🎁 Premio: ${prize}\n⏳ Termina en ${args[args.length - 1]} minutos\n\nReacciona con 🎉 para participar`);
    db.giveaways[giveawayId].messageId = message.id._serialized;
    saveDB();

    setTimeout(async () => {
      const gw = db.giveaways[giveawayId];
      if (!gw || gw.participants.length === 0) return msg.reply('😔 No hubo participantes.');
      const winner = gw.participants[Math.floor(Math.random() * gw.participants.length)];
      msg.reply(`🎊 @${winner.replace('@c.us', '')} ha sido el ganador de **${gw.prize}** 🎁`, { mentions: [winner] });
      delete db.giveaways[giveawayId];
      saveDB();
    }, duration);
  }

  // ⚙️ /config1 → ver configuraciones
  if (cmd === '/config1') {
    msg.reply(`⚙️ Configuración actual:\nAdmins: ${ADMINS.length}\nUsuarios baneados: ${Object.keys(db.bans).length}`);
  }

  // ⚙️ /config2 → formato de sanción
  if (cmd === '/config2') {
    msg.reply(`👤 Usuario: +56 9 9703 1771\n📌 Motivo: razón de baneo\n🕒 Sanción aplicada: tiempo del ban\n👮 Admin responsable: Bot Admin`);
  }
});

// 🎉 Manejo de reacciones para giveaways
client.on('message_reaction', async (reaction) => {
  const msg = reaction.msg;
  const user = reaction.senderId;
  if (reaction.reaction === '🎉') {
    for (let id in db.giveaways) {
      if (db.giveaways[id].messageId === msg.id._serialized) {
        if (!db.giveaways[id].participants.includes(user)) {
          db.giveaways[id].participants.push(user);
          saveDB();
        }
      }
    }
  }
});

client.initialize();
