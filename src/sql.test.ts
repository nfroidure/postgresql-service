import sql, { escapeIdentifier, joinSQLValues } from './sql';

describe('SQL statement', () => {
  test('should work with a raw query', () => {
    const query = sql`SELECT * FROM users`;

    expect({
      text: query.text,
      values: query.values,
    }).toMatchInlineSnapshot(`
      Object {
        "text": "SELECT * FROM users",
        "values": Array [],
      }
    `);
  });

  test('should work with a one parameter query', () => {
    const query = sql`SELECT * FROM users where id=${1}`;

    expect({
      text: query.text,
      values: query.values,
    }).toMatchInlineSnapshot(`
      Object {
        "text": "SELECT * FROM users where id=$1",
        "values": Array [
          1,
        ],
      }
    `);
  });

  test('should work with several parameters query', () => {
    const query = sql`SELECT * FROM users where id=${1} and type=${'admin'}`;

    expect({
      text: query.text,
      values: query.values,
    }).toMatchInlineSnapshot(`
      Object {
        "text": "SELECT * FROM users where id=$1 and type=$2",
        "values": Array [
          1,
          "admin",
        ],
      }
    `);
  });

  test('should work with list like parameters query', () => {
    const query = sql`SELECT * FROM users where id IN (${joinSQLValues([
      1,
      2,
      3,
      4,
    ])}) and type=${'admin'}`;

    expect({
      text: query.text,
      values: query.values,
    }).toMatchInlineSnapshot(`
      Object {
        "text": "SELECT * FROM users where id IN ($1, $2, $3, $4) and type=$5",
        "values": Array [
          1,
          2,
          3,
          4,
          "admin",
        ],
      }
    `);
  });

  test('should work with several parameters query and all types', () => {
    const query = sql`INSERT INTO users (id, name, preferences, creation) VALUES (${1}, ${'paul'}, ${{
      silent: true,
    }}, ${new Date(0)})`;

    expect({
      text: query.text,
      values: query.values,
    }).toMatchInlineSnapshot(`
      Object {
        "text": "INSERT INTO users (id, name, preferences, creation) VALUES ($1, $2, $3, $4)",
        "values": Array [
          1,
          "paul",
          Object {
            "silent": true,
          },
          1970-01-01T00:00:00.000Z,
        ],
      }
    `);
  });

  test('should work with custom identifiers', () => {
    const query = sql`INSERT INTO ${escapeIdentifier(
      'users',
    )} (id, name, preferences, creation) VALUES (${1}, ${'paul'}, ${{
      silent: true,
    }}, ${new Date(0)})`;

    expect({
      text: query.text,
      values: query.values,
    }).toMatchInlineSnapshot(`
      Object {
        "text": "INSERT INTO \\"users\\" (id, name, preferences, creation) VALUES ($1, $2, $3, $4)",
        "values": Array [
          1,
          "paul",
          Object {
            "silent": true,
          },
          1970-01-01T00:00:00.000Z,
        ],
      }
    `);
  });

  test('should work with several custom identifiers', () => {
    const query = sql`INSERT INTO ${escapeIdentifier(
      'users',
    )},  ${escapeIdentifier(
      'members',
    )} (id, name, preferences, creation) VALUES (${1}, ${'paul'}, ${{
      silent: true,
    }}, ${new Date(0)}) AND (
        SELECT COUNT(*) FROM  ${escapeIdentifier('users')} > 1
    )`;

    expect({
      text: query.text,
      values: query.values,
    }).toMatchInlineSnapshot(`
      Object {
        "text": "INSERT INTO \\"users\\",  \\"members\\" (id, name, preferences, creation) VALUES ($1, $2, $3, $4) AND (
              SELECT COUNT(*) FROM  \\"users\\" > 1
          )",
        "values": Array [
          1,
          "paul",
          Object {
            "silent": true,
          },
          1970-01-01T00:00:00.000Z,
        ],
      }
    `);
  });

  test('should work with query composition', () => {
    const query1 = sql`SELECT * FROM users where id=${1} and type=${'admin'}`;
    const query2 = sql`SELECT id, name FROM (
      ${query1}
    ) WHERE name LIKE ${'test'}`;

    expect({
      text: query2.text,
      values: query2.values,
    }).toMatchInlineSnapshot(`
      Object {
        "text": "SELECT id, name FROM (
            SELECT * FROM users where id=$1 and type=$2
          ) WHERE name LIKE $3",
        "values": Array [
          1,
          "admin",
          "test",
        ],
      }
    `);
    const query3 = sql`SELECT id, name FROM (
      ${query1}
    ) WHERE name LIKE ${'test2'}`;
    const query4 = sql`SELECT (
      ${query2}
    ) UNION (
      ${query3}
    )`;
    expect({
      text: query4.text,
      values: query4.values,
    }).toMatchInlineSnapshot(`
      Object {
        "text": "SELECT (
            SELECT id, name FROM (
            SELECT * FROM users where id=$1 and type=$2
          ) WHERE name LIKE $3
          ) UNION (
            SELECT id, name FROM (
            SELECT * FROM users where id=$4 and type=$5
          ) WHERE name LIKE $6
          )",
        "values": Array [
          1,
          "admin",
          "test",
          1,
          "admin",
          "test2",
        ],
      }
    `);
  });
});
