import { describe, expect, it } from 'vitest';
import { extractSqlSymbols } from '../../src/scanner/sql-symbol-extractor.js';

describe('sql symbol extractor', () => {
  it('extracts schema objects and table references', async () => {
    const result = await extractSqlSymbols(
      `CREATE TABLE users (
  id uuid PRIMARY KEY
);

CREATE TABLE api_keys (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id)
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_api_keys_updated_at
BEFORE UPDATE ON api_keys
FOR EACH ROW
EXECUTE PROCEDURE set_updated_at();

CREATE VIEW active_keys AS
SELECT api_keys.id FROM api_keys JOIN users ON users.id = api_keys.user_id;
`,
      'postgres/init.sql',
    );

    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'users',
          kind: 'type',
          parentName: 'table',
        }),
        expect.objectContaining({
          name: 'api_keys',
          kind: 'type',
          parentName: 'table',
        }),
        expect.objectContaining({
          name: 'set_updated_at',
          kind: 'function',
          parentName: 'function',
        }),
        expect.objectContaining({
          name: 'trg_api_keys_updated_at',
          kind: 'type',
          parentName: 'trigger',
        }),
        expect.objectContaining({
          name: 'active_keys',
          kind: 'type',
          parentName: 'view',
        }),
      ]),
    );
    expect(result.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: 'users',
          relationshipType: 'mentions',
        }),
        expect.objectContaining({
          targetId: 'api_keys',
          relationshipType: 'mentions',
        }),
      ]),
    );
  });

  it('extracts alter-table statements as table relationships', async () => {
    const result = await extractSqlSymbols(
      `ALTER TABLE api_keys
ADD CONSTRAINT fk_api_keys_user
FOREIGN KEY (user_id) REFERENCES users(id);
`,
      'postgres/migration.sql',
    );

    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'alter api_keys',
          parentName: 'table',
        }),
      ]),
    );
    expect(result.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetId: 'api_keys',
          relationshipType: 'mentions',
        }),
        expect.objectContaining({
          targetId: 'users',
          relationshipType: 'mentions',
        }),
      ]),
    );
  });
});
