import { Markup } from "telegraf";
import { Cuenta, Gasto, Ingreso } from "../db.js";
import { formatMonto } from "../utils.js";

export const cuentasPendientes = new Map();

function listaKeyboard(cuentas) {
  const botones = cuentas.map(c => [
    Markup.button.callback(`📁 ${c.nombre} (${c.moneda})`, `cuenta:sel:${c.id}`),
  ]);
  botones.push([Markup.button.callback("➕ Nueva cuenta", "cuenta:nueva")]);
  return Markup.inlineKeyboard(botones);
}

function textoLista(cuentas) {
  return cuentas
    .map(c => `📁 *${c.nombre}* (${c.moneda})\nSaldo: ${formatMonto(c.saldo, c.moneda)}`)
    .join("\n\n");
}

async function mostrarDetalleCuenta(ctx, CuentaId, editar = false) {
  const cuenta = await Cuenta.findOne({ where: { id: CuentaId, UsuarioId: ctx.usuario.id } });
  if (!cuenta) return ctx.answerCbQuery("Cuenta no encontrada.");

  const [gastos, ingresos] = await Promise.all([
    Gasto.findAll({ where: { CuentaId }, order: [["fecha", "DESC"]], limit: 5 }),
    Ingreso.findAll({ where: { CuentaId }, order: [["fecha", "DESC"]], limit: 5 }),
  ]);

  const movimientos = [
    ...gastos.map(g => ({ esIngreso: false, data: g })),
    ...ingresos.map(i => ({ esIngreso: true, data: i })),
  ].sort((a, b) => new Date(b.data.fecha) - new Date(a.data.fecha)).slice(0, 5);

  let texto = `📁 *${cuenta.nombre}* (${cuenta.moneda})\nSaldo: *${formatMonto(cuenta.saldo, cuenta.moneda)}*`;

  if (movimientos.length) {
    texto += "\n\n*Últimos movimientos:*\n";
    texto += movimientos
      .map(({ esIngreso, data: m }) => {
        const label = esIngreso ? "⬆️ Ingreso" : "⬇️ Gasto";
        return `${label}: ${formatMonto(m.monto, m.moneda)} — ${m.descripcion}`;
      })
      .join("\n");
  }

  await ctx.editMessageText(texto, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("✏️ Editar cuenta", `cuenta:edit:${CuentaId}`)],
      [Markup.button.callback("◀️ Volver", "cuenta:volver")],
    ]),
  });
  await ctx.answerCbQuery();
}

export function registerCuentasHandlers(bot) {
  bot.command("cuentas", async (ctx) => {
    const cuentas = await Cuenta.findAll({
      where: { UsuarioId: ctx.usuario.id },
      order: [["createdAt", "ASC"]],
    });

    if (!cuentas.length) {
      return ctx.reply(
        "No tenés cuentas creadas todavía.",
        Markup.inlineKeyboard([[Markup.button.callback("➕ Nueva cuenta", "cuenta:nueva")]])
      );
    }

    return ctx.reply(textoLista(cuentas), {
      parse_mode: "Markdown",
      ...listaKeyboard(cuentas),
    });
  });

  bot.action("cuenta:nueva", async (ctx) => {
    cuentasPendientes.set(ctx.from.id, { step: "nombre" });
    await ctx.answerCbQuery();
    await ctx.reply("¿Cómo se llama la cuenta? (ej: Efectivo, Nequi, BBVA)");
  });

  bot.action(/^cuenta:moneda:(COP|USD)$/, async (ctx) => {
    const moneda = ctx.match[1];
    const estado = cuentasPendientes.get(ctx.from.id);

    if (!estado || estado.step !== "moneda") {
      return ctx.answerCbQuery("No hay cuenta pendiente.");
    }

    cuentasPendientes.set(ctx.from.id, { step: "saldo", nombre: estado.nombre, moneda });
    await ctx.editMessageText(
      `¿Cuál es el saldo actual de *${estado.nombre}*? (${moneda})\nEscribí el monto o \`0\` si la cuenta está en cero.`,
      { parse_mode: "Markdown" }
    );
    await ctx.answerCbQuery();
  });

  bot.action(/^cuenta:sel:(\d+)$/, async (ctx) => {
    await mostrarDetalleCuenta(ctx, parseInt(ctx.match[1]));
  });

  // Editar — mostrar opciones
  bot.action(/^cuenta:edit:(\d+)$/, async (ctx) => {
    const CuentaId = ctx.match[1];
    await ctx.editMessageText(
      "¿Qué querés editar?",
      Markup.inlineKeyboard([
        [Markup.button.callback("✏️ Nombre", `cuenta:edit:nombre:${CuentaId}`)],
        [Markup.button.callback("💰 Saldo", `cuenta:edit:saldo:${CuentaId}`)],
        [Markup.button.callback("◀️ Cancelar", `cuenta:sel:${CuentaId}`)],
      ])
    );
    await ctx.answerCbQuery();
  });

  // Editar nombre
  bot.action(/^cuenta:edit:nombre:(\d+)$/, async (ctx) => {
    const CuentaId = parseInt(ctx.match[1]);
    cuentasPendientes.set(ctx.from.id, { step: "edit_nombre", CuentaId });
    await ctx.answerCbQuery();
    await ctx.reply("¿Cuál es el nuevo nombre de la cuenta?");
  });

  // Editar saldo
  bot.action(/^cuenta:edit:saldo:(\d+)$/, async (ctx) => {
    const CuentaId = parseInt(ctx.match[1]);
    const cuenta = await Cuenta.findByPk(CuentaId);
    cuentasPendientes.set(ctx.from.id, { step: "edit_saldo", CuentaId, moneda: cuenta.moneda });
    await ctx.answerCbQuery();
    await ctx.reply(
      `¿Cuál es el saldo actual de la cuenta? (${cuenta.moneda})\nActual: ${formatMonto(cuenta.saldo, cuenta.moneda)}`,
      { parse_mode: "Markdown" }
    );
  });

  bot.action("cuenta:volver", async (ctx) => {
    const cuentas = await Cuenta.findAll({
      where: { UsuarioId: ctx.usuario.id },
      order: [["createdAt", "ASC"]],
    });

    if (!cuentas.length) {
      await ctx.editMessageText(
        "No tenés cuentas creadas todavía.",
        Markup.inlineKeyboard([[Markup.button.callback("➕ Nueva cuenta", "cuenta:nueva")]])
      );
      return ctx.answerCbQuery();
    }

    await ctx.editMessageText(textoLista(cuentas), {
      parse_mode: "Markdown",
      ...listaKeyboard(cuentas),
    });
    await ctx.answerCbQuery();
  });
}
