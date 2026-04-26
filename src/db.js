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

export const Gasto = sequelize.define("Gasto", {
  monto: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  descripcion: { type: DataTypes.STRING, allowNull: false },
  categoria: { type: DataTypes.STRING, allowNull: true },
  moneda: { type: DataTypes.STRING(3), allowNull: false, defaultValue: "COP" },
  fecha: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

Usuario.hasMany(Gasto);
Gasto.belongsTo(Usuario);
