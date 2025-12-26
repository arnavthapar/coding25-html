require('dotenv').config({quiet:true});

const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = process.env.PORT;
const rateLimit = require('express-rate-limit');

// Limit submissions per second per IP
const guessLimiter = rateLimit({
    windowMs: 5 * 1000,
    max: 5,
    message: { success: false, error: 'Too many guesses. Slow down!' }
});
app.use(express.urlencoded({extended: true}));
app.use(cors({origin:`http://localhost:${PORT}`}));

//const bcrypt = require('bcrypt');
//const saltRounds = 10;
const pool = require('./db');

module.exports = pool;
const words = require('./words.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser(process.env.COOKIE_CODE));

function dailyReset(req, res, next) {
    const today = getToday();

    const lastDay = req.signedCookies.lastDay;

    if (lastDay !== today) {
        const cookiesToClear = [
            'guesses',
            'lastDay'
        ];

        cookiesToClear.forEach(name => {
            res.clearCookie(name, {
                httpOnly: true,
                signed: true,
                sameSite: 'lax',
                secure: false,
                path: '/'
            });
        });

        // Set new day marker
        res.cookie('lastDay', today, {
            httpOnly: true,
            signed: true,
            sameSite: 'lax',
            secure: false,
            path: '/',
            maxAge: 24 * 60 * 60 * 1000
        });
    }

    next();
}

app.use(dailyReset);

function oneLetterDiff(word1, word2) {
    if (word1.length !== word2.length) return false;

    let diff = 0;
    for (let i = 0; i < word1.length; i++) {
        if (word1[i] !== word2[i]) diff++;
        if (diff > 1) return false;
    }

    return diff === 1;
}
async function getWordData(day) {
    const [rows] = await pool.query('SELECT * FROM daily WHERE day = ?', [day]);
    if (rows.length === 0) return null;
    return {
        start: rows[0].word1,
        end: rows[0].word2,
        limit: rows[0].dlimit,
        lowest: rows[0].lowest
    };
}
function getToday() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}
function getCount(req) {
    const guesses = Array.isArray(req.signedCookies.guesses)
        ? req.signedCookies.guesses
        : [];
    return guesses.length;
}


app.get('/api/get-guesses', async (req, res) => {
    const guesses = Array.isArray(req.signedCookies.guesses)
        ? req.signedCookies.guesses
        : [];

    const data = await getWordData(getToday());

    let win = false;
    let over = false;

    if (data) {
        if (guesses.includes(data.end)) {
            win = true; // Already won
        } else if (guesses.length >= data.limit) {
            over = true; // Max guesses reached
        }
    }

    res.json({
        guesses,
        win,
        over,
        count: guesses.length
    });
});
app.post('/api/submit_word', guessLimiter, async (req, res) => {
    /*res.clearCookie('guesses', {
    httpOnly: true,
    signed: true,
    secure: false,
    sameSite: 'lax',
    path: '/'
    });*/
    const count = getCount(req) + 1
    const submittedWord = req.body.word?.trim().toLowerCase();
    const data = await getWordData(getToday())
    if (!data) {
        return res.status(404).json({success: false, error: 'No puzzle for today', count:count});
    } else if (count > data.limit) {
        res.json({success: true, valid: false, over: true, count:count});
        return
    }
    let nextOver = false
    if (count == data.limit) {nextOver = true}
    if (!submittedWord) {
        return res.status(400).json({success: false, error: 'No word submitted', count:count});
    }
    
    let exists = words.includes(submittedWord);
    if (exists) {
        let guesses = req.signedCookies.guesses || [];

        if (!Array.isArray(guesses)) guesses = [];
        if (guesses.length === 0) {
        if (!oneLetterDiff(submittedWord, data.start)) {
            return res.json({success: true, nextOver:nextOver, valid: false, over: false, error: 'First guess must differ by exactly one letter from starting word', count: guesses.length});
        }
        } else {
            // Subsequent guesses: compare to previous guess
            const prev = guesses[guesses.length - 1];
            if (!oneLetterDiff(submittedWord, prev)) {
                return res.json({success: true, nextOver:nextOver, valid: false, over: false, error: 'Guess must differ by exactly one letter from previous guess', count: guesses.length});
            }
        }
        // Add the new guess
        guesses.push(submittedWord);

        // Set the cookie again with updated array
        res.cookie('guesses', guesses, {
            httpOnly: true,
            signed: true,
            secure: false, // true if HTTPS
            sameSite: 'lax',
            path: '/',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });
        wordData = await getWordData(getToday());
        let win = false
        if (submittedWord == wordData.end) {win = true}
        res.json({success: true, valid: true, nextOver:nextOver, over:false, win:win, count:count});
    } else {
        res.json({success: true, valid: false, nextOver:nextOver, over:false, win:false, count:count});
    }
});

// Pages
app.get('', (_, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/api/reset', async (_, res) => {
    const cookiesToClear = ['guesses','lastDay'];

    cookiesToClear.forEach(name => {
        res.clearCookie(name, {
            httpOnly: true,
            signed: true,
            sameSite: 'lax',
            secure: false,
            path: '/'
        });
    });
    res.json({success:true})
});
app.get('/api/words', async (req, res) => {
    const data = await getWordData(getToday())
    if (!data) {
        return res.status(404).json({ error:'No puzzle for today'});
    }
    const {start: w1, end: w2, limit, lowest} = data;
    let over = false
    if (getCount(req) >= limit) {
        over = true
    }
    res.json({start:w1, end:w2, lim:limit, over:over, lowest:lowest})
});
app.use((_req, res, _next) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});