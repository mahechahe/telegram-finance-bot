import { Usuario } from "../db.js";

const ADMIN_ID = Number(process.env.TELEGRAM_ID);

export function registerAdminHandlers(bot) {
  bot.command("usuarios", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    const pendientes = await Usuario.findAll({ where: { activo: false } });

    if (!pendientes.length) {
      return ctx.reply("No hay usuarios pendientes de aprobación.");
    }

    const lista = pendientes
      .map((u) => `👤 *${u.nombre}*${u.username ? ` (@${u.username})` : ""}\nID: \`${u.telegramId}\``)
      .join("\n\n");

    return ctx.reply(`Usuarios pendientes:\n\n${lista}`, { parse_mode: "Markdown" });
  });

  bot.action(/^aprobar:(\d+)$/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return ctx.answerCbQuery();

    const telegramId = parseInt(ctx.match[1]);
    const usuario = await Usuario.findOne({ where: { telegramId } });

    if (!usuario) {
      return ctx.answerCbQuery("Usuario no encontrado.");
    }

    await usuario.update({ activo: true });

    try {
      await ctx.telegram.sendMessage(
        telegramId,
        "✅ ¡Tu acceso fue aprobado! Ya podés usar el bot.\n\nEnviame tus gastos así: `25000 Almuerzo`",
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      console.error("No se pudo notificar al usuario aprobado:", e.message);
    }

    const textoOriginal = ctx.callbackQuery.message.text;
    await ctx.editMessageText(`${textoOriginal}\n\n✅ Aprobado`);
    await ctx.answerCbQuery("Usuario aprobado.");
  });
}
