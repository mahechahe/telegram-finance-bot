import { Sequelize, DataTypes } from "sequelize";

export const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false },
  },
});

export const Usuario = sequelize.define("Usuario", {
  telegramId: { type: DataTypes.BIGINT, allowNull: false, unique: true },
  nombre: { type: DataTypes.STRING, allowNull: false },
  username: { type: DataTypes.STRING, allowNull: true },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
});

export const Cuenta = sequelize.define("Cuenta", {
  nombre: { type: DataTypes.STRING, allowNull: false },
  moneda: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "COP" },
  saldo: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
});

export const Gasto = sequelize.define("Gasto", {
  monto: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  descripcion: { type: DataTypes.STRING, allowNull: false },
  moneda: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "COP" },
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

export const Ingreso = sequelize.define("Ingreso", {
  monto: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  descripcion: { type: DataTypes.STRING, allowNull: false },
  moneda: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "COP" },
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

Usuario.hasMany(Gasto);
Gasto.belongsTo(Usuario);

Usuario.hasMany(Cuenta);
Cuenta.belongsTo(Usuario);

Cuenta.hasMany(Gasto, { foreignKey: "CuentaId", as: "Gastos" });
Gasto.belongsTo(Cuenta, { foreignKey: "CuentaId", as: "Cuenta" });

export const Categoria = sequelize.define("Categoria", {
  nombre: { type: DataTypes.STRING, allowNull: false },
});

Usuario.hasMany(Categoria);
Categoria.belongsTo(Usuario);

Categoria.hasMany(Gasto, { foreignKey: "CategoriaId" });
Gasto.belongsTo(Categoria, { foreignKey: "CategoriaId", as: "CategoriaObj" });

Usuario.hasMany(Ingreso);
Ingreso.belongsTo(Usuario);

Cuenta.hasMany(Ingreso, { foreignKey: "CuentaId", as: "IngresosList" });
Ingreso.belongsTo(Cuenta, { foreignKey: "CuentaId", as: "Cuenta" });
