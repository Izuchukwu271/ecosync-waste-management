
const {
  hashPassword,
  verifyPassword,
} = require("./utils/password");

async function testPasswordUtility() {
  const password = "EcoSyncTest123!";

  const passwordHash = await hashPassword(password);

  console.log("Hash created:", passwordHash !== password);
  console.log(
    "Correct password accepted:",
    await verifyPassword(password, passwordHash)
  );
  console.log(
    "Wrong password rejected:",
    !(await verifyPassword("WrongPassword123!", passwordHash))
  );
}

testPasswordUtility().catch((error) => {
  console.error("Password utility test failed:", error.message);
  process.exitCode = 1;
});
