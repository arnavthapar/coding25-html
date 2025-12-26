require('dotenv').config({quiet:true});

const pool = require('./db');
async function runFunction(day, word1, word2, dlimit, lowest) {
    //const [rows] = await pool.query('SELECT * FROM daily');
    const [rows] = await pool.query(`INSERT INTO daily (day, word1, word2, dlimit, lowest) VALUES (\'${day}\', \'${word1}\', \'${word2}\', ${dlimit}, ${lowest});`)
    console.log(rows)
}
runFunction('2025-12-29', 'crane', 'cramp', 12, 2)
