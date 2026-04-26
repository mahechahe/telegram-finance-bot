import "dotenv/config";
import { createServer } from "http";
import { Telegraf, Markup } from "telegraf";
import { Sequelize, DataTypes } from "sequelize";

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false },
  },
});

const Gasto = sequelize.define("Gasto", {
  monto: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  descripcion: { type: DataTypes.STRING, allowNull: false },
  categoria: { type: DataTypes.STRING, allowNull: true },
  moneda: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "COP" },
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

const bot = new Telegraf(process.env.BOT_TOKEN);
const MI_TELEGRAM_ID = Number(process.env.TELEGRAM_ID);

// Gasto pendiente mientras el usuario elige categoría
const pendientes = new Map();

const CATEGORIA_KEYBOARD = Markup.inlineKeyboard([
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

/**
 * Parsea el monto según la moneda.
 *
 * COP: sin decimales, todos los separadores son de miles.
 *   25000 / 25.000 / 25,000 / 1.500.000 → entero
 *
 * USD: el último separador que aparece es el decimal (si va seguido de ≤2 dígitos).
 *   10.50 → 10.50 | 1,234.56 → 1234.56 | 1.234,56 → 1234.56
 */
function parseMonto(raw, moneda) {
  const str = raw.trim();

  if (moneda === "COP") {
    const entero = parseInt(str.replace(/[.,]/g, ""), 10);
    return isNaN(entero) || entero <= 0 ? null : entero;
  }

  // USD: el separador que aparece último es el decimal
  const lastDot = str.lastIndexOf(".");
  const lastComma = str.lastIndexOf(",");

  let normalizado;
  if (lastDot > lastComma) {
    normalizado = str.replace(/,/g, ""); // coma = miles, punto = decimal
  } else if (lastComma > lastDot) {
    normalizado = str.replace(/\./g, "").replace(",", "."); // punto = miles, coma = decimal
  } else {
    normalizado = str; // sin separadores
  }

  const num = parseFloat(normalizado);
  return isNaN(num) || num <= 0 ? null : Math.round(num * 100) / 100;
}

function formatMonto(monto, moneda) {
  const num = Number(monto);
  if (moneda === "COP") {
    return `$${num.toLocaleString("es-CO")} COP`;
  }
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
}

bot.command("start", (ctx) =>
  ctx.reply(
    "¡Hola! Enviame tus gastos así:\n" +
      "`25000 Almuerzo` → pesos colombianos\n" +
      "`10.50 Coffee USD` → dólares\n\n" +
      "Luego elegís la categoría.",
    { parse_mode: "Markdown" }
  )
);

bot.on("text", async (ctx) => {
  if (ctx.from.id !== MI_TELEGRAM_ID || ctx.message.text.startsWith("/")) return;

  const texto = ctx.message.text.trim();

  // Formato: <monto> <descripcion> [USD]
  const match = texto.match(/^([\d.,]+)\s+(.+?)(\s+USD)?$/i);

  if (!match) {
    return ctx.reply(
      "⚠️ Formato incorrecto.\n" +
        "Usá: `25000 Almuerzo` o `10.50 Coffee USD`",
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
  if (ctx.from.id !== MI_TELEGRAM_ID) return ctx.answerCbQuery();

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

try {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  console.log("✅ Conexión a la DB establecida.");
  bot.launch();
  console.log("🚀 Bot de Finanzas arrancado con éxito.");
} catch (error) {
  console.error("Error al iniciar:", error);
}

const PORT = process.env.PORT || 80;
createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot is running...");
}).listen(PORT);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
