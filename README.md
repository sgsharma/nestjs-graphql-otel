NOTE: This repository is based on [NestJS-Yoga-Example](https://github.com/tkosminov/nestjs-yoga-example/tree/master)

# NestJS-Yoga-Example

* NestJS 10
* TypeORM 0.3

## Dependencies

* [NodeJS 18](https://nodejs.org/download/release/latest-v18.x/)
* [PostgreSQL 13](https://www.postgresql.org/download/)

## Prerequisites

- Postgres
```sh
brew install postgresql@13
export PATH="/opt/homebrew/opt/postgresql@13/bin:$PATH"
# Alternatively, add to your shell config
# echo 'export PATH="/opt/homebrew/opt/postgresql@13/bin:$PATH"' >> ~/.zshrc
initdb --locale=C -E UTF-8 /opt/homebrew/var/postgresql@13
pg_ctl -D '/opt/homebrew/var/postgresql@13' -l logfile start
createuser -s postgres
```

## Running the App

```sh
npm ci
npm run typeorm:cli -- -d ./src/database/database-ormconfig.cli.ts migration:generate ./src/database/migrations/generated
npm run typeorm:cli -- migration:create ./src/database/migrations/created
npm run typeorm:cli -- -d ./src/database/database-ormconfig.cli.ts migration:run
npm run typeorm:cli -- -d ./src/database/database-ormconfig.cli.ts schema:sync

export HONEYCOMB_API_KEY=<YOUR-HONEYCOMB-API-KEY>
npm run build
npm run start:build
```
