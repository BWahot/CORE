import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import mysql from 'mysql2/promise';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const schemaPath = path.join(root, 'database/schema.sql');

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true
});

const schema = await fs.readFile(schemaPath, 'utf8');
await connection.query(schema);
await connection.end();

console.log('Database schema initialized.');
