# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the bot

```bash
node index.js
```

No npm scripts are defined (the default `test` script just errors). There are no tests.

## Architecture

Single-file app (`index.js`) with three logical sections:

1. **Database** — Sequelize connects to PostgreSQL via `DATABASE_URL`. Defines a `Gasto` model with `monto` (INTEGER), `descripcion` (STRING), and `fecha` (DATE, defaults to now). `sequelize.sync()` is called on every incoming message (not at startup).

2. **Bot** — Telegraf listens for `text` events. Messages are filtered by `MI_TELEGRAM_ID` (hardcoded at `index.js:23`). Valid messages match `^\d+[\d.]*\s+(.*)$` — amount followed by a space and description. Dots in the amount are stripped before `parseInt`, so `25.000` → `25000`.

3. **Launch** — `bot.launch()` starts long-polling.

## Environment variables

Both are required; loaded from `.env` via `dotenv`:

- `DATABASE_URL` — PostgreSQL connection string (e.g. `postgres://user:pass@host:5432/dbname`)
- `BOT_TOKEN` — Telegram bot token from BotFather

## Key configuration

`MI_TELEGRAM_ID` at `index.js:23` is a numeric constant that gates all message handling. Update it to your own Telegram ID before use (send a message to @userinfobot to find it).
