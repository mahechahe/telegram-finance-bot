import { Usuario } from "../db.js";

const ADMIN_ID = Number(process.env.TELEGRAM_ID);

export async function authMiddleware(ctx, next) {
  if (!ctx.from) return;

  const telegramId = ctx.from.id;
  const nombre = [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(" ");
  const username = ctx.from.username ?? null;

  const [usuario, esNuevo] = await Usuario.findOrCreate({
    where: { telegramId },
    defaults: { nombre, username, activo: telegramId === ADMIN_ID },
  });

  if (!esNuevo && (usuario.nombre !== nombre || usuario.username !== username)) {
    await usuario.update({ nombre, username });
  }

  if (esNuevo && telegramId !== ADMIN_ID) {
    const info = `👤 *${nombre}*${username ? ` (@${username})` : ""}\nID: \`${telegramId}\``;
    await ctx.telegram.sendMessage(
      ADMIN_ID,
      `Nuevo usuario solicitando acceso:\n\n${info}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "✅ Aprobar", callback_data: `aprobar:${telegramId}` }]],
        },
      }
    );
  }

  if (!usuario.activo) {
    await ctx.reply("⏳ Tu solicitud está pendiente de aprobación.");
    return;
  }

  ctx.usuario = usuario;
  return next();
}
