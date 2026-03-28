import { fetchUsers } from './src/services/api.js';
async function run() {
  try {
    const res = await fetchUsers();
    console.log("Success:", res);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
