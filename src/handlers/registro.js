import { Gasto } from "../db.js";
import { pendientes, parseMonto, formatMonto } from "../utils.js";
import { CATEGORIA_KEYBOARD } from "../keyboards.js";

export function registerRegistroHandlers(bot) {
  bot.on("text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) return next();

    const texto = ctx.message.text.trim();
    const match = texto.match(/^([\d.,]+)\s+(.+?)(\s+USD)?$/i);

    if (!match) {
      return ctx.reply(
        "⚠️ Formato incorrecto.\nUsá: `25000 Almuerzo` o `10.50 Coffee USD`",
        { parse_mode: "Markdown" }
      );
    }

    const moneda = match[3] ? "USD" : "COP";
    const monto = parseMonto(match[1], moneda);
    const descripcion = match[2].trim();

    if (!monto) {
      return ctx.reply("⚠️ El monto no es válido.");
    }

    pendientes.set(ctx.from.id, { monto, descripcion, moneda });

    await ctx.reply(
      `${formatMonto(monto, moneda)} — _${descripcion}_\n¿En qué categoría lo clasifico?`,
      { parse_mode: "Markdown", ...CATEGORIA_KEYBOARD }
    );
  });

  bot.action(/^cat:(.+)$/, async (ctx) => {
    const categoria = ctx.match[1];
    const pendiente = pendientes.get(ctx.from.id);

    if (!pendiente) {
      return ctx.answerCbQuery("No hay gasto pendiente.");
    }

    pendientes.delete(ctx.from.id);

    try {
      await Gasto.create({ ...pendiente, categoria });
      await ctx.editMessageText(
        `✅ Guardado\n💰 ${formatMonto(pendiente.monto, pendiente.moneda)}\n📝 ${pendiente.descripcion}\n🏷 ${categoria}`
      );
    } catch (err) {
      console.error("Error en DB:", err);
      await ctx.editMessageText("❌ Error al guardar en la base de datos.");
    }

    await ctx.answerCbQuery();
  });
}
