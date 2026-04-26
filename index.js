import "dotenv/config";
import { Telegraf } from "telegraf";
import { Sequelize, DataTypes } from "sequelize";

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
});

const Gasto = sequelize.define("Gasto", {
  monto: { type: DataTypes.INTEGER, allowNull: false },
  descripcion: { type: DataTypes.STRING, allowNull: false },
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

const bot = new Telegraf(process.env.BOT_TOKEN);

const MI_TELEGRAM_ID = Number(process.env.TELEGRAM_ID);

bot.on("text", async (ctx) => {
  if (ctx.from.id !== MI_TELEGRAM_ID) return;

  const texto = ctx.message.text;
  const regex = /^(\d+[\d.]*)\s+(.*)$/;
  const match = texto.match(regex);

  if (match) {
    const monto = parseInt(match[1].replace(/\./g, ""));
    const descripcion = match[2];

    try {
      await Gasto.create({ monto, descripcion });
      ctx.reply(
        `💰 Registrado: $${monto.toLocaleString()} por "${descripcion}"`,
      );
    } catch (err) {
      console.error(err);
      ctx.reply("❌ Error al guardar en la base de datos.");
    }
  } else {
    ctx.reply("Formato incorrecto. Ejemplo: 25000 Almuerzo");
  }
});

await sequelize.sync();
await bot.launch();
console.log("🚀 Bot de Finanzas arrancado");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
