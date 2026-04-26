import "dotenv/config";
import { createServer } from "http";
import { Telegraf } from "telegraf";
import { Sequelize, DataTypes } from "sequelize";

// 1. Configuración de Base de Datos
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
  // Tip: Para bases de datos en la nube (como Supabase o AWS),
  // a veces necesitas esto para evitar errores de conexión:
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false },
  },
});

const Gasto = sequelize.define("Gasto", {
  monto: { type: DataTypes.INTEGER, allowNull: false },
  descripcion: { type: DataTypes.STRING, allowNull: false },
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

// 2. Inicializar Bot
const bot = new Telegraf(process.env.BOT_TOKEN);
const MI_TELEGRAM_ID = Number(process.env.TELEGRAM_ID);

// 3. Lógica del Bot
bot.on("text", async (ctx) => {
  // Seguridad: Validamos que seas tú y que no sea un comando
  if (ctx.from.id !== MI_TELEGRAM_ID || ctx.message.text.startsWith("/"))
    return;

  const texto = ctx.message.text;
  const regex = /^(\d+[\d.]*)\s+(.*)$/;
  const match = texto.match(regex);

  if (match) {
    // Limpiamos puntos y convertimos a número entero
    const monto = parseInt(match[1].replace(/\./g, ""));
    const descripcion = match[2];

    try {
      await Gasto.create({ monto, descripcion });
      // Formateo local para Colombia: $ 25.000
      ctx.reply(
        `💰 Registrado: $${monto.toLocaleString("es-CO")} por "${descripcion}"`,
      );
    } catch (err) {
      console.error("Error en DB:", err);
      ctx.reply("❌ Error al guardar en la base de datos.");
    }
  } else {
    ctx.reply("⚠️ Formato incorrecto.\nUsa: 25000 Almuerzo");
  }
});

// Comando de ayuda inicial
bot.command("start", (ctx) =>
  ctx.reply('¡Hola Estiven! Envíame tus gastos así: "25000 Almuerzo"'),
);

// 4. Arranque del Servidor
try {
  await sequelize.authenticate();
  await sequelize.sync();
  console.log("✅ Conexión a la DB establecida.");

  bot.launch();
  console.log("🚀 Bot de Finanzas arrancado con éxito.");
} catch (error) {
  console.error("Unable to connect to the database:", error);
}

// 5. El "Keep-Alive" para el hosting
const PORT = process.env.PORT || 80;
createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running...");
}).listen(PORT);

// Manejo de cierre limpio
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
