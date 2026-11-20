import { describe, expect, test } from "bun:test";
import { feedItems } from "@kyomi/db";
import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  keysetFilter,
  keysetOrderBy,
  type KeysetColumns,
} from "@modules/articles/read/list/keyset";

const columns: KeysetColumns = {
  at: feedItems.publishedAt,
  id: feedItems.id,
  isRead: sql`is_read_expr`,
};
const boundary = { at: new Date("2026-07-01T00:00:00.000Z"), id: "item_9" };
const dialect = new PgDialect();
const render = (fragment: Parameters<PgDialect["sqlToQuery"]>[0]) => dialect.sqlToQuery(fragment);

describe("keysetFilter", () => {
  test("latest takes rows strictly older than the boundary, ties broken by smaller id", () => {
    const { sql: text, params } = render(keysetFilter(columns, "latest", boundary));

    expect(text).toMatch(
      /"published_at" < \$1 or \("feed_items"."published_at" = \$2 and "feed_items"."id" < \$3\)/,
    );
    expect(params).toEqual([boundary.at.toISOString(), boundary.at.toISOString(), "item_9"]);
  });

  test("oldest takes rows strictly after the boundary", () => {
    const { sql: text } = render(keysetFilter(columns, "oldest", boundary));

    expect(text).toContain('"feed_items"."published_at" > $1');
    expect(text).toContain('"feed_items"."id" > $3');
  });

  test("unread-first after a read row stays within read rows", () => {
    const { sql: text } = render(
      keysetFilter(columns, "unread-first", { ...boundary, isRead: true }),
    );

    expect(text).toMatch(/^\(\(is_read_expr\) = true and/);
  });

  test("unread-first after an unread row continues unread rows, then all read rows", () => {
    const { sql: text } = render(
      keysetFilter(columns, "unread-first", { ...boundary, isRead: false }),
    );

    expect(text).toMatch(/^\(\(is_read_expr\) = true or \(\(is_read_expr\) = false and/);
  });

  test("unread-first without a read flag falls back to the plain time order", () => {
    expect(render(keysetFilter(columns, "unread-first", boundary))).toEqual(
      render(keysetFilter(columns, "latest", boundary)),
    );
  });
});

describe("keysetOrderBy", () => {
  const order = (sort: Parameters<typeof keysetOrderBy>[1]) =>
    render(sql.join([...keysetOrderBy(columns, sort)], sql`, `)).sql;

  test("latest is newest first", () => {
    expect(order("latest")).toBe('"feed_items"."published_at" desc, "feed_items"."id" desc');
  });

  test("oldest is oldest first", () => {
    expect(order("oldest")).toBe('"feed_items"."published_at" asc, "feed_items"."id" asc');
  });

  test("unread-first puts unread before read, then newest first", () => {
    expect(order("unread-first")).toBe(
      'is_read_expr asc, "feed_items"."published_at" desc, "feed_items"."id" desc',
    );
  });
});
