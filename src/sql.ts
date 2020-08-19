export const SQLStatementTypeSymbol = Symbol('SQLStatement');
export const SQLPartTypeSymbol = Symbol('SQLPart');
export const SQLValuesTypeSymbol = Symbol('SQLValues');
export const SQLTypesSymbols = [
  SQLPartTypeSymbol,
  SQLStatementTypeSymbol,
] as const;

export type SQLStatement = {
  type: typeof SQLStatementTypeSymbol;
  parts: string[];
  values: SQLValue[];
  text: string;
};

export type SQLPart = {
  type: typeof SQLPartTypeSymbol;
  parts: string[];
  values: SQLValue[];
};

export type SQLValues = {
  type: typeof SQLValuesTypeSymbol;
  values: SQLValue[];
};

export type SQLValue = string | number | boolean | object | null | undefined;

export type SQLStringLiteralParameter =
  | SQLStatement
  | SQLPart
  | SQLValue
  | SQLValues;

export const joinSQLValues = (values: SQLValue[]): SQLValues => {
  return {
    type: SQLValuesTypeSymbol,
    values,
  };
};

export const createSQLPart = (str: string): SQLPart => {
  return {
    type: SQLPartTypeSymbol,
    parts: [str],
    values: [],
  };
};

export const emptySQLPart = createSQLPart('');

export const escapeSQLIdentifier = (str: string): SQLPart => {
  return createSQLPart('"' + str.replace(/"/g, '""') + '"');
};

function isSQLValues(value: SQLStringLiteralParameter): value is SQLValues {
  return (
    typeof value === 'object' &&
    value !== null &&
    ((value as unknown) as SQLValues).type == SQLValuesTypeSymbol
  );
}

function isSQLPart(value: SQLStringLiteralParameter): value is SQLPart {
  return (
    typeof value === 'object' &&
    value !== null &&
    ((value as unknown) as SQLPart).type == SQLPartTypeSymbol
  );
}

function isSQLStatement(
  value: SQLStringLiteralParameter,
): value is SQLStatement {
  return (
    typeof value === 'object' &&
    value !== null &&
    ((value as unknown) as SQLStatement).type == SQLStatementTypeSymbol
  );
}

/* Architecture Note #1.1: Tagged template queries

The `pg` module uses simple `$n` placeholder for queries values
 that are provided in an array.

This tagged template function adds a level of abstraction
 transforming the following expression:
 `sql\`SELECT * FROM users WHERE id=${userId}\`` with `userId=1` }
 into `{ text: 'SELECT * FROM users WHERE id=$1', values: [1] }`
 under the hood.
*/
export default function sql<T extends SQLStringLiteralParameter[]>(
  chunks: TemplateStringsArray,
  ...parameters: T
): SQLStatement {
  const { parts, values } = mergeSQLChunks(chunks, parameters);
  return {
    type: SQLStatementTypeSymbol,
    parts,
    values,
    get text() {
      return this.parts.reduce(
        (text: string, part: string, index: number) =>
          text + part + (index < this.values.length ? '$' + (index + 1) : ''),
        '',
      );
    },
  };
}

export function sqlPart<T extends SQLStringLiteralParameter[]>(
  chunks: TemplateStringsArray,
  ...parameters: T
): SQLPart {
  const { parts, values } = mergeSQLChunks(chunks, parameters);
  return {
    type: SQLPartTypeSymbol,
    parts,
    values,
  };
}

function mergeSQLChunks(chunks, parameters) {
  const parts = [];
  const values: SQLValue[] = [];
  const parametersLength = parameters.length;

  for (let i = 0, len = chunks.length; i < len; i++) {
    const unterminatedPart = parts.length > values.length;

    if (i >= parametersLength) {
      if (unterminatedPart) {
        parts.push((parts.pop() || '') + chunks[i]);
      } else {
        parts.push(chunks[i]);
      }
      continue;
    }

    if (isSQLStatement(parameters[i]) || isSQLPart(parameters[i])) {
      if (unterminatedPart) {
        parts.push(
          (parts.pop() || '') +
            chunks[i] +
            (parameters[i] as SQLStatement).parts[0],
        );
      } else {
        parts.push(chunks[i] + (parameters[i] as SQLStatement).parts[0]);
      }
      parts.push(...(parameters[i] as SQLStatement).parts.slice(1));
      values.push(...(parameters[i] as SQLStatement).values);
    } else if (isSQLValues(parameters[i])) {
      if (!unterminatedPart) {
        parts.push((parts.pop() || '') + chunks[i]);
      } else {
        parts.push(chunks[i]);
      }
      parts.push(
        ...(parameters[i] as SQLValues).values.slice(1).map(() => ', '),
      );
      values.push(...(parameters[i] as SQLValues).values);
    } else {
      if (unterminatedPart) {
        parts.push((parts.pop() || '') + chunks[i]);
      } else {
        parts.push(chunks[i]);
      }
      values.push(parameters[i]);
    }
  }

  return {
    parts,
    values,
  };
}
