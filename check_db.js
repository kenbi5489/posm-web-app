const { db } = require('./src/services/db');
async function check() {
  const all = await db.posmData.toArray();
  const statuses = [...new Set(all.map(i => i.status))];
  console.log('Statuses found:', statuses);
  console.log('Total items:', all.length);
  const doneCount = all.filter(i => i.status === 'Done').length;
  console.log('Items with status === "Done":', doneCount);
}
check();
