import 'dotenv/config';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';

// Usage: npm run admin:create -- <username> <password>
async function main() {
  const [, , username, password] = process.argv;
  if (!username || !password) {
    console.error('Usage: npm run admin:create -- <username> <password>');
    process.exit(1);
  }

  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
  const hash = await bcrypt.hash(password, 10);
  await sql`
    INSERT INTO admins (username, password_hash)
    VALUES (${username}, ${hash})
    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
  `;
  console.log(`Admin "${username}" created/updated.`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
