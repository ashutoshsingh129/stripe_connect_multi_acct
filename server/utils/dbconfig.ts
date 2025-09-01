import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
    user: process.env['PG_USER'],
    host: process.env['PG_HOST'],
    database: process.env['PG_DB'],
    password: process.env['PG_PASS'],
    port: Number(process.env['PG_PORT']),
    ssl: {
        rejectUnauthorized: false,
    },
});
pool.on('error', (err: Error) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});
