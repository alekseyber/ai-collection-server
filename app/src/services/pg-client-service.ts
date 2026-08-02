import pkg from 'pg';
const { Pool } = pkg;

// const pool = new Pool({
//   host: 'localhost',
//   port: 5432,
//   database: 'pgdb',
//   user: 'pguser',
//   password: process.env.PGPASS || 'pgpass',
// });

//CREATE TABLE docs (
// id serial PRIMARY KEY,
// source  text,
//  content text,
// embedding vector(768)
//);

/**
 * table docs_nomic максимальное качество поиска / семантического соответствия и тебя не пугает вектор 768 → nomic-embed-text
 * table docs меньше память/диск и быстрее поиск, а данные не супер‑сложные (обычный текст, документация, чат‑контент)  384 → all-minilm:l6-v2
 */

const TABLE_NAME = 'docs_nomic';

export type RowSimilar = { id: number; source: string; content: string; similarity: number };

export class PgClientService {
  private pool: typeof Pool;

  constructor() {
    this.pool = new Pool({
      host: 'postgres',
      port: 5432,
      database: 'pgdb',
      user: 'pguser',
      password: process.env.PGPASS || 'pgpass',
    });
  }

  private getEmbString(emb: number[]) {
    return `[${emb.join(',')}]`;
  }

  public async saveChunk(source: string, content: string, qEmb: number[]) {
    const qEmbStr = this.getEmbString(qEmb);
    await this.pool.query(
      `INSERT INTO ${TABLE_NAME} (source, content, embedding) VALUES ($1, $2, $3::vector)`,
      [source, content, qEmbStr],
    );
  }

  public async searchSimilar(qEmb: number[], topK: number = 5): Promise<RowSimilar[]> {
    const qEmbStr = this.getEmbString(qEmb);

    const { rows } = await this.pool.query(
      `
    SELECT
      id,
      source,
      content,
      1 - (embedding <=> $1::vector) AS similarity
    FROM ${TABLE_NAME}
    ORDER BY embedding <=> $1::vector
    LIMIT $2
    `,
      [qEmbStr, topK],
    );
    return rows;
  }
}
