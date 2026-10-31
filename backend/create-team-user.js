require("dotenv").config();

const readline = require("readline/promises");
const { stdin, stdout } = require("process");

const pool = require("./config/db");
const { hashPassword } = require("./utils/password");

async function createTeamUser() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const fullName = "EcoSync Test Team";
    const email = "team.test@ecosync.local";

    const password = await rl.question(
      "Enter a password (at least 12 characters): "
    );

    if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
      throw new Error("Password must be at least 12 characters and no more than 72 bytes.");
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO public.app_users
        (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'waste_management_team')
       ON CONFLICT (email) DO NOTHING
       RETURNING id, full_name, email, role`,
      [fullName, email, passwordHash]
    );

    if (result.rows.length === 0) {
      console.log("This test account already exists.");
    } else {
      console.log("Team test account created:");
      console.log(result.rows[0]);
    }
  } catch (error) {
    console.error("Account creation failed:", error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await pool.end();
  }
}

createTeamUser();