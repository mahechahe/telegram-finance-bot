import { Op } from "sequelize";
import { Gasto, Ingreso, Cuenta, Categoria } from "../db.js";
import { formatMonto, formatFecha, startOfDayBogota } from "../utils.js";
import { filtroKeyboard, fechaNavKeyboard } from "../keyboards.js";
import { getCategorias } from "./categorias.js";

// ── Formato de cada movimiento ─────────────────────────────────────────────────

function formatGasto(g) {
  return [
    `⬇️ ${g.descripcion}`,
    `💰 ${formatMonto(g.monto, g.moneda)}`,
    `🏷 ${g.CategoriaObj?.nombre ?? "Sin categoría"}`,
    g.Cuenta ? `📁 ${g.Cuenta.nombre}` : null,
    `📅 ${formatFecha(g.fecha)}`,
  ].filter(Boolean).join("\n");
}

function formatIngreso(i) {
  return [
    `⬆️ ${i.descripcion}`,
    `💰 ${formatMonto(i.monto, i.moneda)}`,
    i.Cuenta ? `📁 ${i.Cuenta.nombre}` : null,
    `📅 ${formatFecha(i.fecha)}`,
  ].filter(Boolean).join("\n");
}

// ── Queries ────────────────────────────────────────────────────────────────────

const INCLUDE_GASTO = [
  { model: Cuenta, as: "Cuenta", attributes: ["nombre"] },
  { model: Categoria, as: "CategoriaObj", attributes: ["nombre"] },
];

const INCLUDE_INGRESO = [
  { model: Cuenta, as: "Cuenta", attributes: ["nombre"] },
];

async function fetchGastos(where, limit = 50) {
  return Gasto.findAll({ where, include: INCLUDE_GASTO, order: [["fecha", "DESC"]], limit });
}

async function fetchIngresos(where, limit = 50) {
  return Ingreso.findAll({ where, include: INCLUDE_INGRESO, order: [["fecha", "DESC"]], limit });
}

// Merge gastos + ingresos, ordena por fecha y limita
async function fetchMovimientos({ whereGastos, whereIngresos, limit = 10 }) {
  const [gastos, ingresos] = await Promise.all([
    whereGastos ? fetchGastos(whereGastos) : [],
    whereIngresos ? fetchIngresos(whereIngresos) : [],
  ]);

  return [
    ...gastos.map(g => ({ esIngreso: false, data: g })),
    ...ingresos.map(i => ({ esIngreso: true, data: i })),
  ]
    .sort((a, b) => new Date(b.data.fecha) - new Date(a.data.fecha))
    .slice(0, limit);
}

async function fetchResumenMes(UsuarioId) {
  const hoy = new Date();
  const { desde: inicioMes } = rangoMes(hoy.getFullYear(), hoy.getMonth() + 1);

  const [gastos, ingresos] = await Promise.all([
    fetchGastos({ UsuarioId, fecha: { [Op.gte]: inicioMes } }),
    fetchIngresos({ UsuarioId, fecha: { [Op.gte]: inicioMes } }),
  ]);

  const mapaGastos = {};
  for (const g of gastos) {
    const nombreCat = g.CategoriaObj?.nombre ?? "Sin categoría";
    const key = `${nombreCat}|${g.moneda}`;
    if (!mapaGastos[key]) mapaGastos[key] = { categoria: nombreCat, moneda: g.moneda, total: 0 };
    mapaGastos[key].total += Number(g.monto);
  }

  const mapaIngresos = {};
  for (const i of ingresos) {
    if (!mapaIngresos[i.moneda]) mapaIngresos[i.moneda] = { moneda: i.moneda, total: 0 };
    mapaIngresos[i.moneda].total += Number(i.monto);
  }

  return {
    gastos: Object.values(mapaGastos).sort((a, b) => a.categoria.localeCompare(b.categoria)),
    ingresos: Object.values(mapaIngresos),
  };
}

// ── Rangos de fecha ────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function rangoHoy() {
  const desde = startOfDayBogota();
  return { desde, hasta: new Date(desde.getTime() + DAY_MS) };
}

function rangoSemana() {
  const desde = startOfDayBogota(new Date(Date.now() - 6 * DAY_MS));
  const hasta = new Date(startOfDayBogota().getTime() + DAY_MS);
  return { desde, hasta };
}

function rangoMes(year, month) {
  const pad = n => String(n).padStart(2, "0");
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;
  return {
    desde: new Date(`${year}-${pad(month)}-01T00:00:00-05:00`),
    hasta: new Date(`${nextYear}-${pad(nextMonth)}-01T00:00:00-05:00`),
  };
}

async function mostrarPorFecha(ctx, titulo, desde, hasta, keyboard) {
  const UsuarioId = ctx.usuario.id;
  const LIMIT = 20;
  const fechaWhere = { [Op.gte]: desde, [Op.lt]: hasta };

  const movimientos = await fetchMovimientos({
    whereGastos: { UsuarioId, fecha: fechaWhere },
    whereIngresos: { UsuarioId, fecha: fechaWhere },
    limit: LIMIT + 1,
  });

  const hayMas = movimientos.length > LIMIT;
  const mostrar = hayMas ? movimientos.slice(0, LIMIT) : movimientos;

  if (!mostrar.length) {
    await ctx.editMessageText(
      `${titulo}\n\nNo hay movimientos en este período.`,
      keyboard ? { parse_mode: "Markdown", ...keyboard } : { parse_mode: "Markdown" }
    );
    return ctx.answerCbQuery();
  }

  const cuerpo = mostrar
    .map(({ esIngreso, data }) => esIngreso ? formatIngreso(data) : formatGasto(data))
    .join("\n\n──────────\n\n");
  const pie = hayMas ? "\n\n_... y más movimientos no mostrados_" : "";

  await ctx.editMessageText(
    `${titulo}\n\n${cuerpo}${pie}`,
    keyboard ? { parse_mode: "Markdown", ...keyboard } : { parse_mode: "Markdown" }
  );
  await ctx.answerCbQuery();
}

// ── Handlers ───────────────────────────────────────────────────────────────────

export function registerConsultaHandlers(bot) {
  bot.command("gastos", async (ctx) => {
    const categorias = await getCategorias(ctx.usuario.id);
    return ctx.reply("¿Qué movimientos querés ver?", filtroKeyboard(categorias));
  });

  bot.action(/^gastos:(.+)$/, async (ctx) => {
    const filtro = ctx.match[1];
    const UsuarioId = ctx.usuario.id;

    // ── Por fecha ─────────────────────────────────────────────────────────────
    if (filtro === "fecha") {
      const hoy = new Date();
      const year = hoy.getFullYear();
      const month = hoy.getMonth() + 1;
      const { desde, hasta } = rangoMes(year, month);
      const mes = new Date(year, month - 1, 1).toLocaleString("es-CO", { month: "long", year: "numeric" });
      return mostrarPorFecha(ctx, `📅 *${mes}*`, desde, hasta, fechaNavKeyboard(year, month));
    }

    if (filtro.startsWith("rapido:")) {
      const tipo = filtro.split(":")[1];
      let desde, hasta, titulo;
      if (tipo === "hoy") {
        ({ desde, hasta } = rangoHoy()); titulo = "📅 *Hoy*";
      } else if (tipo === "semana") {
        ({ desde, hasta } = rangoSemana()); titulo = "📅 *Últimos 7 días*";
      } else if (tipo === "mes") {
        const hoy = new Date();
        ({ desde, hasta } = rangoMes(hoy.getFullYear(), hoy.getMonth() + 1));
        titulo = `📅 *${hoy.toLocaleString("es-CO", { month: "long", year: "numeric" })}*`;
      } else if (tipo === "mes-anterior") {
        const hoy = new Date();
        const month = hoy.getMonth() === 0 ? 12 : hoy.getMonth();
        const year  = hoy.getMonth() === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
        ({ desde, hasta } = rangoMes(year, month));
        titulo = `📅 *${new Date(year, month - 1, 1).toLocaleString("es-CO", { month: "long", year: "numeric" })}*`;
      }
      return mostrarPorFecha(ctx, titulo, desde, hasta, null);
    }

    if (filtro.startsWith("nav:")) {
      const [year, month] = filtro.split(":")[1].split("-").map(Number);
      const { desde, hasta } = rangoMes(year, month);
      const mes = new Date(year, month - 1, 1).toLocaleString("es-CO", { month: "long", year: "numeric" });
      return mostrarPorFecha(ctx, `📅 *${mes}*`, desde, hasta, fechaNavKeyboard(year, month));
    }

    // ── Resumen ───────────────────────────────────────────────────────────────
    if (filtro === "resumen") {
      const { gastos, ingresos } = await fetchResumenMes(UsuarioId);
      const mes = new Date().toLocaleString("es-CO", { month: "long", year: "numeric" });

      if (!gastos.length && !ingresos.length) {
        await ctx.editMessageText("No hay movimientos registrados este mes.");
        return ctx.answerCbQuery();
      }

      const lineas = [`📊 *Resumen de ${mes}:*\n`];
      if (ingresos.length) {
        lineas.push("📥 *Ingresos*");
        lineas.push(...ingresos.map(i => `   ${formatMonto(i.total, i.moneda)}`));
        lineas.push("");
      }
      if (gastos.length) {
        lineas.push("📤 *Gastos por categoría*");
        lineas.push(...gastos.map(g => `🏷 ${g.categoria}: ${formatMonto(g.total, g.moneda)}`));
      }

      await ctx.editMessageText(lineas.join("\n"), { parse_mode: "Markdown" });
      return ctx.answerCbQuery();
    }

    // ── Filtros por categoría / ingresos / todos ──────────────────────────────
    let movimientos;

    if (filtro === "ingresos") {
      movimientos = await fetchMovimientos({ whereIngresos: { UsuarioId } });
    } else if (filtro.startsWith("cat:")) {
      const CategoriaId = parseInt(filtro.slice(4));
      movimientos = await fetchMovimientos({ whereGastos: { UsuarioId, CategoriaId } });
    } else {
      // todos
      movimientos = await fetchMovimientos({ whereGastos: { UsuarioId }, whereIngresos: { UsuarioId } });
    }

    if (!movimientos.length) {
      await ctx.editMessageText("No hay movimientos registrados.");
      return ctx.answerCbQuery();
    }

    await ctx.editMessageText(
      movimientos.map(({ esIngreso, data }) => esIngreso ? formatIngreso(data) : formatGasto(data))
        .join("\n\n──────────\n\n")
    );
    await ctx.answerCbQuery();
  });
}
