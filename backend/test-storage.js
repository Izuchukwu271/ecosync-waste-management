
require("dotenv").config();

const supabase = require("./config/supabase");

async function testStorageConnection() {
  try {
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      throw error;
    }

    const bucketExists = data.some(
      (bucket) => bucket.name === process.env.SUPABASE_BUCKET
    );

    if (!bucketExists) {
      console.error("Connection succeeded, but the expected bucket was not found.");
      console.log("Check the bucket name in your Supabase dashboard.");
      process.exitCode = 1;
      return;
    }

    console.log("Supabase Storage connection successful!");
    console.log("EcoSync photo bucket is available.");
  } catch (error) {
    console.error("Storage connection test failed:", error.message);
    process.exitCode = 1;
  }
}

testStorageConnection();
