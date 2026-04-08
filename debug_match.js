// Simplified matching logic from useSync.js
const assert = require('assert');

// Master data
const mPId = ""; // Assuming empty pic_id in Master? We need to know.
const mPName = "le anh tuan"; // stripAccents("Lê Anh Tuấn").toLowerCase().trim()

// Report data
const picName = "Lê Anh Tuấn";
// nameToId resolving: if user is not in users array, picId is ""
const pidNorm = ""; 
const pNameNorm = "le anh tuan"; 

console.log("Master:", { mPId, mPName });
console.log("Report:", { pidNorm, pNameNorm });

if (pidNorm && mPId && mPId !== pidNorm) {
    console.log("FAILED rule 1");
} else if (!mPId && mPName !== pNameNorm) {
    console.log("FAILED rule 2");
} else {
    console.log("MATCHED!");
}
