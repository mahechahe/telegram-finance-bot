import "dotenv/config";
import { createServer } from "http";
import { Telegraf } from "telegraf";
import { sequelize } from "./src/db.js";
import { registerRegistroHandlers } from "./src/handlers/registro.js";
import { registerConsultaHandlers } from "./src/handlers/consulta.js";

const bot = new Telegraf(process.env.BOT_TOKEN);
const MI_TELEGRAM_ID = Number(process.env.TELEGRAM_ID);

bot.use((ctx, next) => {
  if (ctx.from?.id !== MI_TELEGRAM_ID) return;
  return next();
});

bot.command("start", (ctx) =>
  ctx.reply(
    "¡Hola! Enviame tus gastos así:\n" +
      "`25000 Almuerzo` → pesos colombianos\n" +
      "`10.50 Coffee USD` → dólares\n\n" +
      "Usá /gastos para consultar tus registros.",
    { parse_mode: "Markdown" }
  )
);

registerRegistroHandlers(bot);
registerConsultaHandlers(bot);

try {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  console.log("✅ Conexión a la DB establecida.");
  bot.launch();
  console.log("🚀 Bot de Finanzas arrancado con éxito.");
} catch (error) {
  console.error("Error al iniciar:", error);
}

const PORT = process.env.PORT || 80;
createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running...");
}).listen(PORT);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
