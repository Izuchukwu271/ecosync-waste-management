
const pool = require("./config/db");

async function testDatabaseConnection() {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database_name,
        current_user AS database_user,
        PostGIS_Full_Version() AS postgis_version
    `);

    console.log("Database connection successful!");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("Database connection failed:");
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testDatabaseConnection();
