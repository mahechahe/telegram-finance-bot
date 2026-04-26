import { Markup } from "telegraf";

export const CATEGORIA_KEYBOARD = Markup.inlineKeyboard([
  [
    Markup.button.callback("🏠 Hogar", "cat:Hogar"),
    Markup.button.callback("🍽 Comida", "cat:Comida"),
  ],
  [
    Markup.button.callback("🚌 Transporte", "cat:Transporte"),
    Markup.button.callback("💳 Créditos/Deudas", "cat:Créditos/Deudas"),
  ],
  [
    Markup.button.callback("🎉 Entretenimiento", "cat:Entretenimiento"),
    Markup.button.callback("👨‍👩‍👧 Familia", "cat:Familia"),
  ],
  [Markup.button.callback("📦 Otro", "cat:Otro")],
]);

export const FILTRO_KEYBOARD = Markup.inlineKeyboard([
  [Markup.button.callback("📋 Todos", "gastos:todos")],
  [
    Markup.button.callback("🏠 Hogar", "gastos:Hogar"),
    Markup.button.callback("🍽 Comida", "gastos:Comida"),
  ],
  [
    Markup.button.callback("🚌 Transporte", "gastos:Transporte"),
    Markup.button.callback("💳 Créditos/Deudas", "gastos:Créditos/Deudas"),
  ],
  [
    Markup.button.callback("🎉 Entretenimiento", "gastos:Entretenimiento"),
    Markup.button.callback("👨‍👩‍👧 Familia", "gastos:Familia"),
  ],
  [Markup.button.callback("📦 Otro", "gastos:Otro")],
  [Markup.button.callback("📊 Resumen del mes", "gastos:resumen")],
]);
