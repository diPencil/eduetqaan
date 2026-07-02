/**
 * SQL Generator Utility
 * Converts Outbox payloads into raw SQL statements for manual injection into MySQL.
 */

export function generateSqlFromOutbox(row) {
  const { modelName, op, payload } = row;
  const tableName = getTableName(modelName);
  const { data, where } = payload;

  if (op === 'create') {
    const keys = Object.keys(data);
    const values = keys.map(k => escapeSqlValue(data[k]));
    return `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${values.join(', ')});`;
  }

  if (op === 'update') {
    const sets = Object.keys(data).map(k => `${k} = ${escapeSqlValue(data[k])}`);
    const conditions = Object.keys(where).map(k => `${k} = ${escapeSqlValue(where[k])}`);
    return `UPDATE ${tableName} SET ${sets.join(', ')} WHERE ${conditions.join(' AND ')};`;
  }

  if (op === 'delete') {
    const conditions = Object.keys(where).map(k => `${k} = ${escapeSqlValue(where[k])}`);
    return `DELETE FROM ${tableName} WHERE ${conditions.join(' AND ')};`;
  }

  return `-- Unsupported operation: ${op}`;
}

/**
 * Maps model names to physical table names if different.
 * Defaults to snake_case version of the model name.
 */
function getTableName(modelName) {
  // Add specific mappings if needed
  const mapping = {
    'AdminUser': 'users',
    'CommunityQuestion': 'community_questions',
    'CommunityAnswer': 'community_answers'
  };
  
  if (mapping[modelName]) return mapping[modelName];
  
  // Generic camelCase to snake_case
  return modelName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).replace(/^_/, '');
}

/**
 * Escapes values for SQL strings.
 */
function escapeSqlValue(val) {
  if (val === null) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  
  return `'${String(val).replace(/'/g, "''")}'`;
}
