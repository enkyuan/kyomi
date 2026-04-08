import { Elysia } from "elysia";
import { db, pool } from "./client";

export const dbPlugin = new Elysia({
  name: "db.plugin",
})
  .decorate("db", db)
  .decorate("pool", pool);
