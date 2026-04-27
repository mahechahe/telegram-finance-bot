import { Markup } from "telegraf";

export const CATEGORIA_KEYBOARD_STATIC = Markup.inlineKeyboard([
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

// Teclado dinámico de categorías para registrar un gasto.
// Usa el ID en el callback para evitar el límite de 64 bytes de Telegram.
export function categoriaKeyboard(categorias) {
  const rows = [];
  for (let i = 0; i < categorias.length; i += 2) {
    const row = [Markup.button.callback(categorias[i].nombre, `cat:${categorias[i].id}`)];
    if (categorias[i + 1]) {
      row.push(Markup.button.callback(categorias[i + 1].nombre, `cat:${categorias[i + 1].id}`));
    }
    rows.push(row);
  }
  return Markup.inlineKeyboard(rows);
}

// Teclado dinámico para /gastos con las categorías del usuario.
export function filtroKeyboard(categorias) {
  const rows = [
    [
      Markup.button.callback("📋 Todos", "gastos:todos"),
      Markup.button.callback("📥 Ingresos", "gastos:ingresos"),
    ],
  ];
  for (let i = 0; i < categorias.length; i += 2) {
    const row = [Markup.button.callback(categorias[i].nombre, `gastos:cat:${categorias[i].id}`)];
    if (categorias[i + 1]) {
      row.push(Markup.button.callback(categorias[i + 1].nombre, `gastos:cat:${categorias[i + 1].id}`));
    }
    rows.push(row);
  }
  rows.push([Markup.button.callback("📊 Resumen del mes", "gastos:resumen")]);
  rows.push([Markup.button.callback("📅 Por fecha", "gastos:fecha")]);
  return Markup.inlineKeyboard(rows);
}

export function cuentaKeyboard(cuentas) {
  return Markup.inlineKeyboard(
    cuentas.map(c => [Markup.button.callback(`📁 ${c.nombre} (${c.moneda})`, `reg:cuenta:${c.id}`)])
  );
}

export function fechaNavKeyboard(year, month) {
  const label = new Date(year, month - 1, 1)
    .toLocaleString("es-CO", { month: "long", year: "numeric" });

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;

  const fmt = (y, m) => `${y}-${String(m).padStart(2, "0")}`;

  return Markup.inlineKeyboard([
    [
      Markup.button.callback("📅 Hoy", "gastos:rapido:hoy"),
      Markup.button.callback("📅 Esta semana", "gastos:rapido:semana"),
    ],
    [
      Markup.button.callback("📅 Este mes", "gastos:rapido:mes"),
      Markup.button.callback("📅 Mes anterior", "gastos:rapido:mes-anterior"),
    ],
    [
      Markup.button.callback("◀️", `gastos:nav:${fmt(prevYear, prevMonth)}`),
      Markup.button.callback(label, `gastos:nav:${fmt(year, month)}`),
      Markup.button.callback("▶️", `gastos:nav:${fmt(nextYear, nextMonth)}`),
    ],
  ]);
}
