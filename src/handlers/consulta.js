import { Op } from "sequelize";
import { Gasto } from "../db.js";
import { formatMonto, formatFecha } from "../utils.js";
import { FILTRO_KEYBOARD } from "../keyboards.js";

function formatGasto(g) {
  return [
    `📝 ${g.descripcion}`,
    `💰 ${formatMonto(g.monto, g.moneda)}`,
    `🏷 ${g.categoria ?? "Sin categoría"}`,
    `📅 ${formatFecha(g.fecha)}`,
  ].join("\n");
}

async function fetchGastos(where = {}) {
  return Gasto.findAll({ where, order: [["fecha", "DESC"]], limit: 10 });
}

async function fetchResumenMes() {
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const gastos = await Gasto.findAll({
    where: { fecha: { [Op.gte]: inicioMes } },
  });

  // Agrupar por categoría + moneda para no mezclar COP y USD
  const mapa = {};
  for (const g of gastos) {
    const key = `${g.categoria ?? "Sin categoría"}|${g.moneda}`;
    if (!mapa[key]) {
      mapa[key] = { categoria: g.categoria ?? "Sin categoría", moneda: g.moneda, total: 0 };
    }
    mapa[key].total += Number(g.monto);
  }

  return Object.values(mapa).sort((a, b) => a.categoria.localeCompare(b.categoria));
}

export function registerConsultaHandlers(bot) {
  bot.command("gastos", (ctx) =>
    ctx.reply("¿Qué gastos querés ver?", FILTRO_KEYBOARD)
  );

  bot.action(/^gastos:(.+)$/, async (ctx) => {
    const filtro = ctx.match[1];

    if (filtro === "resumen") {
      const resumen = await fetchResumenMes();

      if (!resumen.length) {
        await ctx.editMessageText("No hay gastos registrados este mes.");
        return ctx.answerCbQuery();
      }

      const mes = new Date().toLocaleString("es-CO", { month: "long", year: "numeric" });
      const lineas = resumen.map((r) => `🏷 ${r.categoria}: ${formatMonto(r.total, r.moneda)}`);
      await ctx.editMessageText(`📊 Resumen de ${mes}:\n\n${lineas.join("\n")}`);
      return ctx.answerCbQuery();
    }

    const where = filtro !== "todos" ? { categoria: filtro } : {};
    const gastos = await fetchGastos(where);

    if (!gastos.length) {
      await ctx.editMessageText("No hay gastos registrados.");
      return ctx.answerCbQuery();
    }

    await ctx.editMessageText(gastos.map(formatGasto).join("\n\n──────────\n\n"));
    await ctx.answerCbQuery();
  });
}
