import { Markup } from "telegraf";
import { Gasto, Ingreso, Cuenta, Categoria } from "../db.js";
import { pendientes, parseMonto, formatMonto } from "../utils.js";
import { categoriaKeyboard, cuentaKeyboard } from "../keyboards.js";
import { cuentasPendientes } from "./cuentas.js";
import { categoriaPendiente, getCategorias } from "./categorias.js";

async function obtenerCuentas(UsuarioId, moneda) {
  const cuentas = await Cuenta.findAll({ where: { UsuarioId }, order: [["createdAt", "ASC"]] });
  if (cuentas.length > 0) return { cuentas, nueva: false };
  const cuenta = await Cuenta.create({ nombre: "General", moneda, saldo: 0, UsuarioId });
  return { cuentas: [cuenta], nueva: true };
}

async function guardarEgreso(data) {
  const { monto, CuentaId } = data;
  await Gasto.create(data);
  await Cuenta.increment({ saldo: -Number(monto) }, { where: { id: CuentaId } });
}

async function guardarIngreso(data) {
  const { monto, CuentaId } = data;
  await Ingreso.create(data);
  await Cuenta.increment({ saldo: Number(monto) }, { where: { id: CuentaId } });
}

export function registerRegistroHandlers(bot) {
  bot.on("text", async (ctx, next) => {
    if (ctx.message.text.startsWith("/")) return next();

    // ── Flujo de creación/edición de cuenta ──────────────────────────────────
    const estadoCuenta = cuentasPendientes.get(ctx.from.id);

    if (estadoCuenta?.step === "nombre") {
      const nombre = ctx.message.text.trim();
      cuentasPendientes.set(ctx.from.id, { step: "moneda", nombre });
      return ctx.reply(
        `¿En qué moneda es *${nombre}*?`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([[
            Markup.button.callback("🇨🇴 COP", "cuenta:moneda:COP"),
            Markup.button.callback("🇺🇸 USD", "cuenta:moneda:USD"),
          ]]),
        }
      );
    }

    if (estadoCuenta?.step === "edit_nombre") {
      const nombre = ctx.message.text.trim();
      cuentasPendientes.delete(ctx.from.id);
      await Cuenta.update({ nombre }, { where: { id: estadoCuenta.CuentaId, UsuarioId: ctx.usuario.id } });
      return ctx.reply(`✅ Nombre actualizado a *${nombre}*.`, { parse_mode: "Markdown" });
    }

    if (estadoCuenta?.step === "edit_saldo") {
      const raw = ctx.message.text.trim();
      const saldo = raw === "0" ? 0 : parseMonto(raw, estadoCuenta.moneda);
      if (saldo === null) {
        return ctx.reply(
          "⚠️ Monto inválido. Escribí el saldo actual (ej: `150.000`) o `0`.",
          { parse_mode: "Markdown" }
        );
      }
      cuentasPendientes.delete(ctx.from.id);
      await Cuenta.update({ saldo }, { where: { id: estadoCuenta.CuentaId, UsuarioId: ctx.usuario.id } });
      return ctx.reply(`✅ Saldo actualizado a ${formatMonto(saldo, estadoCuenta.moneda)}.`, { parse_mode: "Markdown" });
    }

    if (estadoCuenta?.step === "saldo") {
      const raw = ctx.message.text.trim();
      const saldo = raw === "0" ? 0 : parseMonto(raw, estadoCuenta.moneda);
      if (saldo === null) {
        return ctx.reply(
          "⚠️ Monto inválido. Escribí el saldo actual (ej: `150.000`) o `0` si la cuenta está en cero.",
          { parse_mode: "Markdown" }
        );
      }
      cuentasPendientes.delete(ctx.from.id);
      const cuenta = await Cuenta.create({
        nombre: estadoCuenta.nombre,
        moneda: estadoCuenta.moneda,
        saldo,
        UsuarioId: ctx.usuario.id,
      });
      return ctx.reply(
        `✅ Cuenta *${cuenta.nombre}* creada.\nSaldo inicial: ${formatMonto(saldo, estadoCuenta.moneda)}`,
        { parse_mode: "Markdown" }
      );
    }

    // ── Flujo de creación/edición de categoría ───────────────────────────────
    const estadoCat = categoriaPendiente.get(ctx.from.id);

    if (estadoCat?.step === "nueva") {
      const nombre = ctx.message.text.trim();
      categoriaPendiente.delete(ctx.from.id);
      await Categoria.create({ nombre, UsuarioId: ctx.usuario.id });
      return ctx.reply(`✅ Categoría *${nombre}* creada.`, { parse_mode: "Markdown" });
    }

    if (estadoCat?.step === "edit") {
      const nombre = ctx.message.text.trim();
      categoriaPendiente.delete(ctx.from.id);
      await Categoria.update({ nombre }, { where: { id: estadoCat.id, UsuarioId: ctx.usuario.id } });
      return ctx.reply(`✅ Categoría actualizada a *${nombre}*.`, { parse_mode: "Markdown" });
    }

    // ── Registro de movimiento ───────────────────────────────────────────────
    const texto = ctx.message.text.trim();
    const esIngreso = texto.startsWith("+");
    const textoLimpio = esIngreso ? texto.slice(1).trim() : texto;
    const match = textoLimpio.match(/^([\d.,]+)\s+(.+?)(\s+USD)?$/i);

    if (!match) {
      return ctx.reply(
        "⚠️ Formato incorrecto.\n" +
        "Egreso: `25000 Almuerzo`\n" +
        "Ingreso: `+2.500.000 Salario`",
        { parse_mode: "Markdown" }
      );
    }

    const moneda = match[3] ? "USD" : "COP";
    const monto = parseMonto(match[1], moneda);
    const descripcion = match[2].trim();

    if (!monto) return ctx.reply("⚠️ El monto no es válido.");

    const { cuentas, nueva } = await obtenerCuentas(ctx.usuario.id, moneda);
    const notaCuenta = nueva ? "\n_(cuenta 'General' creada automáticamente)_" : "";

    if (cuentas.length === 1) {
      const cuenta = cuentas[0];

      if (esIngreso) {
        await guardarIngreso({ monto, descripcion, moneda, CuentaId: cuenta.id, UsuarioId: ctx.usuario.id });
        return ctx.reply(
          `✅ Ingreso guardado\n💰 ${formatMonto(monto, moneda)}\n📝 ${descripcion}\n📁 ${cuenta.nombre}${notaCuenta}`,
          { parse_mode: "Markdown" }
        );
      }

      const categorias = await getCategorias(ctx.usuario.id);
      pendientes.set(ctx.from.id, { monto, descripcion, moneda, CuentaId: cuenta.id });
      return ctx.reply(
        `${formatMonto(monto, moneda)} — _${descripcion}_\n📁 ${cuenta.nombre}\n¿En qué categoría?${notaCuenta}`,
        { parse_mode: "Markdown", ...categoriaKeyboard(categorias) }
      );
    }

    // esIngreso se guarda para saber qué hacer al seleccionar cuenta
    pendientes.set(ctx.from.id, { monto, descripcion, moneda, esIngreso });
    return ctx.reply(
      `${formatMonto(monto, moneda)} — _${descripcion}_\n¿A qué cuenta?`,
      { parse_mode: "Markdown", ...cuentaKeyboard(cuentas) }
    );
  });

  bot.action(/^reg:cuenta:(\d+)$/, async (ctx) => {
    const CuentaId = parseInt(ctx.match[1]);
    const pendiente = pendientes.get(ctx.from.id);
    if (!pendiente) return ctx.answerCbQuery("No hay movimiento pendiente.");

    const cuenta = await Cuenta.findByPk(CuentaId);

    if (pendiente.esIngreso) {
      pendientes.delete(ctx.from.id);
      await guardarIngreso({ ...pendiente, CuentaId, UsuarioId: ctx.usuario.id });
      await ctx.editMessageText(
        `✅ Ingreso guardado\n💰 ${formatMonto(pendiente.monto, pendiente.moneda)}\n📝 ${pendiente.descripcion}\n📁 ${cuenta?.nombre ?? ""}`
      );
      return ctx.answerCbQuery();
    }

    const categorias = await getCategorias(ctx.usuario.id);
    pendientes.set(ctx.from.id, { ...pendiente, CuentaId });
    await ctx.editMessageText(
      `${formatMonto(pendiente.monto, pendiente.moneda)} — _${pendiente.descripcion}_\n📁 ${cuenta?.nombre ?? ""}\n¿En qué categoría?`,
      { parse_mode: "Markdown", ...categoriaKeyboard(categorias) }
    );
    await ctx.answerCbQuery();
  });

  bot.action(/^cat:(\d+)$/, async (ctx) => {
    const catId = parseInt(ctx.match[1]);
    const pendiente = pendientes.get(ctx.from.id);
    if (!pendiente) return ctx.answerCbQuery("No hay gasto pendiente.");

    const cat = await Categoria.findByPk(catId);
    pendientes.delete(ctx.from.id);

    try {
      await guardarEgreso({ ...pendiente, CategoriaId: catId, UsuarioId: ctx.usuario.id });
      await ctx.editMessageText(
        `✅ Guardado\n💰 ${formatMonto(pendiente.monto, pendiente.moneda)}\n📝 ${pendiente.descripcion}\n🏷 ${cat?.nombre ?? "Sin categoría"}`
      );
    } catch (err) {
      console.error("Error en DB:", err);
      await ctx.editMessageText("❌ Error al guardar en la base de datos.");
    }

    await ctx.answerCbQuery();
  });
}
