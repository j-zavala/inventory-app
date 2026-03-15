# Inventory App

Simple CRUD web app. Part 2 focuses on a
single-table UI for the `mydb.computers` table in PostgreSQL.

## What this project does

- Connects an Express + EJS app to PostgreSQL
- Displays a dashboard with a quick summary of computer records
- Supports create, read, update, and delete operations for computers
- Uses the schema in [db/schema.sql](db/schema.sql)

## Prerequisites

- Node.js and npm installed
- PostgreSQL installed and running
- A PostgreSQL user that can create a database and load the schema

## 1. Clone the project and install dependencies

```bash
npm install
```

## 2. Create the database

Create a database named `inventory_app`:

```bash
createdb -h 127.0.0.1 -U postgres inventory_app
```

If `createdb` is not in your `PATH`, use the full PostgreSQL install path on
your machine.

## 3. Load the schema

Run the schema file:

```bash
psql -h 127.0.0.1 -U postgres -d inventory_app -f db/schema.sql
```

This creates the `mydb` schema and all tables used by the app.

## 4. Configure environment variables

Copy `.env.example` to `.env` and add your database connection string:

```env
DATABASE_URL=postgresql://postgres:your-password@127.0.0.1:5432/inventory_app
```

## 5. Start the app

For normal use:

```bash
npm start
```

For development with automatic restart:

```bash
npm run dev
```

## 6. Open the app

Visit:

[http://localhost:3000](http://localhost:3000)

## Part 2 Demo Flow

Use the app like this:

1. Open `/computers`
2. Click `Add computer`
3. Create a new row in the `computers` table
4. Return to the list and confirm the row appears
5. Click `Edit` to update values like status or model
6. Click `Delete` to remove the row

For part 2, `current_location_id` is intentionally left blank, to just focus work on the `computers` table.

## Project Structure

- [server.js](server.js): Express server and CRUD routes
- [db/schema.sql](db/schema.sql): PostgreSQL schema
- [views/](views/): EJS templates - User interface for CRUD operations.
- [public/styles.css](public/styles.css): App styling

## Notes

- The app currently focuses on the `computers` table for the single-table CRUD
  requirement.
- `db/seed.sql` is currently empty, so new databases will start without sample
  data.
- If the database is empty, create the first computer record through the UI.
