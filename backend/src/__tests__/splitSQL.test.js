// beacon2/backend/src/__tests__/splitSQL.test.js
// Unit tests for splitSQL() in ../utils/migrate.js.  Written after a stray
// semicolon in a line comment in tenant_schema.sql silently broke tenant
// migrations on Render — the splitter now ignores semicolons inside
// comments, strings, and dollar-quoted blocks.

import { describe, it, expect } from 'vitest';
import { splitSQL } from '../utils/migrate.js';

describe('splitSQL()', () => {
  it('splits simple statements on top-level semicolons', () => {
    const out = splitSQL('SELECT 1; SELECT 2; SELECT 3;');
    expect(out).toHaveLength(3);
    expect(out[0]).toBe('SELECT 1');
    expect(out[1]).toBe('SELECT 2');
    expect(out[2]).toBe('SELECT 3');
  });

  it('tolerates a trailing statement without a terminator', () => {
    const out = splitSQL('SELECT 1; SELECT 2');
    expect(out).toHaveLength(2);
    expect(out[1]).toBe('SELECT 2');
  });

  it('ignores semicolons inside -- line comments', () => {
    const sql = `
      -- first comment; with a semicolon
      CREATE TABLE foo (
        -- inline; comment
        id INT
      );
      CREATE INDEX foo_idx ON foo (id);
    `;
    const out = splitSQL(sql);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('CREATE TABLE foo');
    expect(out[0]).toContain('id INT');
    expect(out[1]).toContain('CREATE INDEX foo_idx');
  });

  it('ignores semicolons inside /* block comments */ even across lines', () => {
    const sql = `
      /* banner comment;
         with semicolons; inside */
      CREATE TABLE a (id INT);
      /* another; comment */ CREATE TABLE b (id INT);
    `;
    const out = splitSQL(sql);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('CREATE TABLE a');
    expect(out[1]).toContain('CREATE TABLE b');
  });

  it("ignores semicolons inside 'single-quoted strings'", () => {
    const sql = `INSERT INTO t VALUES ('one; two'); INSERT INTO t VALUES ('three');`;
    const out = splitSQL(sql);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("'one; two'");
    expect(out[1]).toContain("'three'");
  });

  it("treats '' as an escaped quote inside a string (stays in-string)", () => {
    const sql = `INSERT INTO t VALUES ('it''s; fine'); SELECT 1;`;
    const out = splitSQL(sql);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain("'it''s; fine'");
    expect(out[1]).toBe('SELECT 1');
  });

  it('ignores semicolons inside $$ dollar-quoted blocks', () => {
    const sql = `
      DO $$
      BEGIN
        RAISE NOTICE 'hi;';
        PERFORM 1;
      END
      $$;
      SELECT 2;
    `;
    const out = splitSQL(sql);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('$$');
    expect(out[0]).toContain("RAISE NOTICE 'hi;'");
    expect(out[1]).toBe('SELECT 2');
  });

  it('preserves comment and string content verbatim in the output', () => {
    const sql = `-- keep me\nCREATE TABLE x (id INT);`;
    const out = splitSQL(sql);
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('-- keep me');
    expect(out[0]).toContain('CREATE TABLE x');
  });

  it('returns no empty statements for repeated or trailing semicolons', () => {
    const out = splitSQL(';;SELECT 1;;;');
    expect(out).toEqual(['SELECT 1']);
  });

  it('regression: the exact saved_reports comment pattern no longer splits mid-statement', () => {
    const sql = `
      -- Saved parameterised SQL reports. SQL is SELECT/WITH only; parameters
      -- is a JSONB array of objects.
      CREATE TABLE IF NOT EXISTS u3a_demo.saved_reports (
        id          SERIAL PRIMARY KEY,
        parameters  JSONB NOT NULL DEFAULT '[]'
      );
      CREATE UNIQUE INDEX IF NOT EXISTS saved_reports_name ON u3a_demo.saved_reports (name);
    `;
    const out = splitSQL(sql);
    expect(out).toHaveLength(2);
    expect(out[0]).toContain('CREATE TABLE IF NOT EXISTS u3a_demo.saved_reports');
    expect(out[0]).toContain('parameters');
    expect(out[1]).toContain('CREATE UNIQUE INDEX');
  });
});
