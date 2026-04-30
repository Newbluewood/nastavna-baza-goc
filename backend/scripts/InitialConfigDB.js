require('dotenv').config();
const {
  EXECUTE_FLAG,
  hasExecuteFlag,
  createConnection,
  resetApplicationTables,
  seedAdmin,
  seedBasePages
} = require('./dbLifecycleShared');

async function run() {
  const shouldExecute = hasExecuteFlag();
  const connection = await createConnection();

  try {
    console.log('Connected to database for InitialConfigDB.');
    console.log(shouldExecute ? 'MODE: execute' : `MODE: dry-run (add ${EXECUTE_FLAG} to apply)`);

    await resetApplicationTables(connection, shouldExecute);
    const admin = await seedAdmin(connection, shouldExecute);
    await seedBasePages(connection, shouldExecute);

    console.log('InitialConfigDB finished.');
    console.log(`Admin credentials after reset: ${admin.username} / ${admin.password}`);
    console.log('Database state: clean schema, reset IDs, no demo guests/news/facilities/reservations.');
  } finally {
    await connection.end();
  }
}

run().catch((err) => {
  console.error('InitialConfigDB failed:', err.message);
  process.exitCode = 1;
});