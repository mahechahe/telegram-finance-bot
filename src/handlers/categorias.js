import { Markup } from "telegraf";
import { Categoria } from "../db.js";

export const categoriaPendiente = new Map();

const DEFAULTS = [
  "🏠 Hogar",
  "🍽 Comida",
  "🚌 Transporte",
  "💳 Créditos/Deudas",
  "🎉 Entretenimiento",
  "👨‍👩‍👧 Familia",
  "📦 Otro",
];

export async function getCategorias(UsuarioId) {
  const existentes = await Categoria.findAll({
    where: { UsuarioId },
    order: [["createdAt", "ASC"]],
  });
  if (existentes.length > 0) return existentes;

  await Categoria.bulkCreate(DEFAULTS.map(nombre => ({ nombre, UsuarioId })));
  return Categoria.findAll({ where: { UsuarioId }, order: [["createdAt", "ASC"]] });
}

function listaKeyboard(categorias) {
  const rows = [];
  for (let i = 0; i < categorias.length; i += 2) {
    const row = [Markup.button.callback(categorias[i].nombre, `cat_cfg:sel:${categorias[i].id}`)];
    if (categorias[i + 1]) {
      row.push(Markup.button.callback(categorias[i + 1].nombre, `cat_cfg:sel:${categorias[i + 1].id}`));
    }
    rows.push(row);
  }
  rows.push([Markup.button.callback("➕ Nueva categoría", "cat_cfg:nueva")]);
  return Markup.inlineKeyboard(rows);
}

export function registerCategoriasHandlers(bot) {
  bot.command("categorias", async (ctx) => {
    const categorias = await getCategorias(ctx.usuario.id);
    return ctx.reply("Tus categorías — tocá una para editarla:", listaKeyboard(categorias));
  });

  bot.action("cat_cfg:nueva", async (ctx) => {
    categoriaPendiente.set(ctx.from.id, { step: "nueva" });
    await ctx.answerCbQuery();
    await ctx.reply("¿Cómo se llama la nueva categoría? (podés incluir emoji, ej: 🚗 Auto)");
  });

  bot.action(/^cat_cfg:sel:(\d+)$/, async (ctx) => {
    const id = parseInt(ctx.match[1]);
    const cat = await Categoria.findOne({ where: { id, UsuarioId: ctx.usuario.id } });
    if (!cat) return ctx.answerCbQuery("Categoría no encontrada.");

    await ctx.editMessageText(
      `Categoría: *${cat.nombre}*`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("✏️ Editar nombre", `cat_cfg:edit:${id}`)],
          [Markup.button.callback("◀️ Volver", "cat_cfg:volver")],
        ]),
      }
    );
    await ctx.answerCbQuery();
  });

  bot.action(/^cat_cfg:edit:(\d+)$/, async (ctx) => {
    const id = parseInt(ctx.match[1]);
    categoriaPendiente.set(ctx.from.id, { step: "edit", id });
    await ctx.answerCbQuery();
    await ctx.reply("¿Cuál es el nuevo nombre?");
  });

  bot.action("cat_cfg:volver", async (ctx) => {
    const categorias = await getCategorias(ctx.usuario.id);
    await ctx.editMessageText(
      "Tus categorías — tocá una para editarla:",
      listaKeyboard(categorias)
    );
    await ctx.answerCbQuery();
  });
}
