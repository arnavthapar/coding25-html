require('dotenv').config({quiet:true});

const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = process.env.PORT;

app.use(express.urlencoded({ extended: true }));
app.use(cors({origin:`http://localhost:${PORT}`}));

//const bcrypt = require('bcrypt');
//const saltRounds = 10;
const pool = require('./db');

module.exports = pool;
const words = require('./words.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser([process.env.COOKIE_CODE]));


async function getWordData(day) {
    const [rows] = await pool.query('SELECT * FROM daily WHERE day = ?', [day]);
    if (rows.length === 0) return null;
    return {
        start: rows[0].word1,
        end: rows[0].word2,
        limit: rows[0].dlimit
    };
}
function getToday() {
    return new Date().toISOString().slice(0, 10);
}

// Logout
app.post('/api/logout', (_req, res) => {
    res.clearCookie('user');
    res.json({success: true});
});

app.post('/api/submit_word', (req, res) => {
    const submittedWord = req.body.word?.trim().toLowerCase();

    if (!submittedWord) {
        return res.status(400).json({ success: false, error: 'No word submitted' });
    }

    const exists = words.includes(submittedWord);

    if (exists) {
        res.json({ success: true, valid: true });
    } else {
        res.json({ success: true, valid: false });
    }
});

// Pages
app.get('', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/words', async (_, res) => {
    const data = await getWordData(getToday())
    if (!data) {
        return res.status(404).json({ error: 'No puzzle for today' });
    }
    const {start: w1, end: w2, limit} = data;
    res.json({start:w1, end:w2, lim:limit})
});
app.use((_req, res, _next) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});