// Estado temporal mientras el usuario elige categoría
export const pendientes = new Map();

/**
 * Parsea el monto según la moneda.
 *
 * COP: sin decimales, todos los separadores son de miles.
 *   25000 / 25.000 / 25,000 / 1.500.000 → entero
 *
 * USD: el último separador que aparece es el decimal.
 *   10.50 → 10.50 | 1,234.56 → 1234.56 | 1.234,56 → 1234.56
 */
export function parseMonto(raw, moneda) {
  const str = raw.trim();

  if (moneda === "COP") {
    const entero = parseInt(str.replace(/[.,]/g, ""), 10);
    return isNaN(entero) || entero <= 0 ? null : entero;
  }

  const lastDot = str.lastIndexOf(".");
  const lastComma = str.lastIndexOf(",");

  let normalizado;
  if (lastDot > lastComma) {
    normalizado = str.replace(/,/g, ""); // coma = miles, punto = decimal
  } else if (lastComma > lastDot) {
    normalizado = str.replace(/\./g, "").replace(",", "."); // punto = miles, coma = decimal
  } else {
    normalizado = str;
  }

  const num = parseFloat(normalizado);
  return isNaN(num) || num <= 0 ? null : Math.round(num * 100) / 100;
}

export function formatMonto(monto, moneda) {
  const num = Number(monto);
  if (moneda === "COP") {
    return `$${num.toLocaleString("es-CO")} COP`;
  }
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
}

export function formatFecha(date) {
  return new Date(date).toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
