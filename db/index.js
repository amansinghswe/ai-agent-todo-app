import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';

dotenv.config();
const db = drizzle(process.env.DATABASE_URL);
