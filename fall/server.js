require('dotenv').config({quiet:true});
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const app = express();
app.use(cors({origin:'http://localhost:8080'}));
const PORT = 8080;
const bcrypt = require('bcrypt');
const saltRounds = 10;
const pool = require('./db');
module.exports = pool;
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser([process.env.SHADOW_MILK_COOKIE_CODE]));
const qualitiesData = require('./data/qualities.json');
let qualities = qualitiesData;

const importantQ = qualitiesData.importantQ;
const screens = require('./data/screens.json');
async function addCP(stat, amount = 1, username, item = false, success=true, level=false) {
    userData = await getUserData(username);

    if (item) {
        if (!userData.items[stat]) {userData.items[stat] = 0;}
        userData.items[stat] += amount;
        userData.items[stat] = Math.round(userData.items[stat] * 100) / 100;
    } else if (level) {
        if (!userData.qualities[stat]) {
            userData.qualities[stat] = amount;
        } else {
            userData.qualities[stat] += amount;
        }
    } else if (stat === "location") {
        userData.locationP = amount;
    } else {
        if (!userData.cp[stat]) userData.cp[stat] = 0;
        if (!userData.qualities[stat]) userData.qualities[stat] = 0;
        userData.cp[stat] += amount;
        while (userData.cp[stat] >= userData.qualities[stat] + 1) {
            userData.cp[stat] -= (userData.qualities[stat] + 1);
            userData.qualities[stat] += 1;
        }
        while (userData.cp[stat] < 0 && userData.qualities[stat] > 0) {
            userData.cp[stat] += (userData.qualities[stat]);
            userData.qualities[stat] -= 1;
        }
        userData.cp[stat] = Math.max(0, userData.cp[stat]);
    }
    await pool.query(
    'UPDATE users SET qualities = ?, cp = ?, items = ?, locationP = ?, success = ? WHERE username = ?',
    [
        JSON.stringify(userData.qualities),
        JSON.stringify(userData.cp),
        JSON.stringify(userData.items),
        userData.locationP,
        success,
        username
    ]);
    return userData.locationP;
}

async function renderMultiple(multipleId, cp=false, username) {
    let userData = await getUserData(username)
    const multiples = screens.multiples;
    const bordered = [];
    const multiple = multiples[multipleId];
    if (!multiple) {
        throw new Error(`Multiple ID ${multipleId} not found`);
    }

    let innerHTML = '';

    const entries = Object.entries(multiple);
    if (entries.length === 0) return;

    const [titleName, titleData] = entries[0];
    const [desc, cpStat = null, cpGain = null] = titleData;

    if (cpStat && cpGain !== null && !cp) {
        await addCP(cpStat, cpGain, username, success=true);
        userData = await getUserData(username);
    }

    const level = cpStat ? (qualities[cpStat] || 0) : null;
    const cpProgress = cpStat ? (userData.cp[cpStat] || 0) : null;

    // title
    innerHTML += `
        <div class="box">
            <div class="info">
                <h2>${titleName}</h2>
                <p>${desc}</p>
                ${cpStat ? `
                <p>
                    <strong>${cpStat}</strong>: +${cpGain} CP<br>
                    Level: ${level} <span style="font-size: 0.85em">(${cpProgress}/${level + 1} CP)</span>
                    <progress value="${cpProgress}" max="${level + 1}"></progress>
                </p>` : ''}
            </div>
        </div>
    `;
    const options = [];

    for (let i = 1; i < entries.length; i++) {
        const [title, data] = entries[i];
        let [desc, qualityKey, dataChance, screenId, requiredStat, showIfLocked = false, multiple = false, extras = {}] = data;
        if (extras["loc"] === true) {
            multiple = true;
            screenId = screens.loc[userData.locationP]
        }
        let percent = 100;
        if (qualityKey) {
            let qualityAmount = 0;
            if (qualityKey === "Luck") {
                qualityAmount = 5;
            } else {
                qualityAmount = userData.qualities[qualityKey] || 0;
            }
            percent = Math.floor((qualityAmount / dataChance) * 100);
            if (isNaN(dataChance)) {percent = 100};
            percent = Math.max(0, Math.min(100, percent));
        }
        let isLocked = false;
        let conditionMessages = [];

        if (requiredStat !== undefined) {
            let allMet = true;
            for (let i = 0; i < requiredStat.length; i += 2) {
                let stat = requiredStat[i];
                const cond = requiredStat[i + 1].toString();
                let op = "";
                let playerVal = "";
                let val = "";

                if (stat === "location") {
                    val = cond;
                    playerVal = locationP;
                    op = 3;
                } else if (stat === "item") {
                    playerVal = userData.items[requiredStat[i+2]] || 0;
                    val = cond.toString().slice(1);
                    op = parseInt(cond[0]);
                    stat = "Your amount of " + requiredStat[i+2];
                    i++;
                } else {
                    playerVal = userData.qualities[stat] || 0;
                    op = parseInt(cond[0]);
                    val = parseInt(cond.slice(1));
                }

                let met = false;
                let cmpStr = "";
                switch (op) {
                    case 1: met = playerVal > val;  cmpStr = `greater than <strong>${val}</strong>`; break;
                    case 2: met = playerVal < val;  cmpStr = `less than <strong>${val}</strong>`; break;
                    case 3: met = playerVal === val; cmpStr = `equal to <strong>${val}</strong>`; break;
                }
                if (!met) allMet = false;
                if (requiredStat[i] === "item") {
                    conditionMessages.push(`You ${met ? "meet" : "don't meet"} the requirement: You have an amount of <strong>${stat}</strong> ${cmpStr} (amount currently <strong>${playerVal}</strong>).`);
                } else {
                    conditionMessages.push(`You ${met ? "meet" : "don't meet"} the requirement: <strong>${stat}</strong> is ${cmpStr} (currently <strong>${playerVal}</strong>).`);
                }
            }
            isLocked = !allMet;
        }

        if (isLocked && showIfLocked !== true) continue;
        options.push({
            title, desc, qualityKey, dataChance, screenId, percent,
            isLocked, unlockMsg: conditionMessages, multiple
        });
        lastChoice = options;
    }

    // sort locked last
    options.sort((a, b) => a.isLocked - b.isLocked);

    // render
    for (const opt of options) {
        //if (opt.isLocked) box.classList.add('locked');
        let box = '';
        let challengeHTML = '';
        if (opt.qualityKey !== null && opt.dataChance !== null) {
            challengeHTML = `
                <p class="challenge">
                    <span class="challenge-msg">${getChallengeMessage(opt.percent)}</span><br>
                    Due to your ${opt.qualityKey}, this is a <span class="chance" style="color:${getChallengeColor(opt.percent)}">${opt.percent}%</span> chance of success.
                    <button type="button" data-value="${opt.screenId}" ${opt.isLocked ? 'disabled' : ''}>Attempt</button>
                </p>`;
        } else {
            challengeHTML = `
                <p><button type="button" data-value="${opt.screenId}" ${opt.isLocked ? 'disabled' : ''}>Go</button></p>`;
        }

        box = `
            <div class="info">
                <h2>${opt.title}</h2>
                <p>${opt.desc}</p>
                ${challengeHTML}
                ${opt.unlockMsg.map(msg => `<p class="unlock-msg">${msg}</p>`).join('')}
            </div>`;

        bordered.push([box]);
    }
    return {"in":innerHTML, "bor":bordered, "op":options, "loc":userData.locationP};
}

function getChallengeMessage(percent) {
    if (percent === 0) return "This is an impossible challenge.";
    if (percent <= 10) return "This is an almost impossible challenge.";
    if (percent <= 30) return "This is an extremely difficult challenge.";
    if (percent <= 60) return "This is a somewhat difficult challenge.";
    if (percent < 90) return "This is a likely to succeed challenge.";
    if (percent < 100) return "This is an almost guaranteed challenge.";
    return "This is a guaranteed challenge.";
}
function getChallengeColor(percent) {
    if (percent <= 5) return "#c41f1f";
    if (percent <= 15) return "#e06666";
    if (percent <= 40) return "#e69138";
    if (percent <= 70) return "#ffd966";
    if (percent <= 90) return "#93c47d";
    return "#6aa84f";
}
function renderScreen(screenId, username, last) {
    const screen = screens.screens[screenId];

    if (screenId === null) {
        return renderMultiple(last, false, username);
    }
    if (screen === undefined) {
        throw new Error(`Screen ID ${screenId} undefined!`);
    }

    const [title, text, showBack = true, nextIsMultiple = true, nextId] = screen[0];
    let buttonHTML = '';
    if (showBack) {
        buttonHTML = `<button type="button" id="backBtn">Back</button>`;
    } else {
        buttonHTML = `<button type="button" id="continueBtn">Continue</button>`;
    }
    return [`
        <div class="box">
            <div class="info">
                <h2>${title}</h2>
                <p>${text}</p>
                ${buttonHTML}
            </div>
        </div>
    `, nextIsMultiple, nextId, showBack];
}
async function attemptScreen(screenId, desc, previousId, username, cp) {
    let userData = await getUserData(username)
    const screen = screens.screens[Number(screenId)];
    if (!screen) {1``
        throw new Error(`Screen ID ${screenId} not found!`);
    }
    // Get percent due to frontend not knowing or being able to send it
    const multiple = screens.multiples[previousId];
    if (!multiple) {
        throw new Error(`Multiple ID ${previousId} not found.`);
    }

    const option = multiple[desc];
    if (!option) {
        throw new Error(`Option "${desc}" not found in multiple ${previousId}.`);
    }

    const qualityKey = option[1];
    const threshold = option[2];

    let percent = null;
    if (qualityKey && threshold !== null) {
        let currentValue = userData.qualities[qualityKey] ?? 0;
        if (qualityKey === "Luck") {
            currentValue = 5;
        }
        percent = Math.floor((currentValue / threshold) * 100);
    }

    const rn = Math.random() * 100;
    let result = rn > percent ? 1 : 0;
    if (!screen[result]) {
        result = 0
    }
    if (!cp) {
        result = userData.success;
    }
    let [
            title,
            text,
            showBack = true,
            nextIsMultiple = true,
            nextId = previousId,
            cpRewardRaw = null,
            extras = {}
        ] = screen[result];
    const cpReward = cpRewardRaw ? [...cpRewardRaw] : [];
    if (!showBack && showBack !== false) {
        showBack = true;
    }
    if (!nextIsMultiple && nextIsMultiple !== false) {
        nextIsMultiple = true;
    }
    if (!nextId && nextId !== 0) {
        nextId = previousId;
    }
    let cpMsg = "";
    percent = Math.min(100, Math.max(percent, 0))
    if (['Shadowy', 'Persuasive', 'Dangerous', 'Watchful'].includes(qualityKey)) {
        if (userData.qualities[qualityKey] > 5) {
            if (result === 1) {
                cpReward.push(qualityKey);
                cpReward.push(Math.round(0.025*(100-percent)));
            } else {
                cpReward.push(qualityKey);
                cpReward.push(Math.round(0.05*(125-percent)));
            }
        } else {
            cpReward.push(qualityKey);
            cpReward.push(Math.random() < 0.7 ? 2 : 1);
        }
    }
    if (Array.isArray(cpReward)) {
        let cpMsgParts = [];
        for (let i = 0; i < cpReward.length; i += 2) {
            const cpStat = cpReward[i];
            const cpGain = cpReward[i + 1];
            if (cpStat === "location") {
                await addCP(cpStat, cpGain, username, false, result);
                userData = await getUserData(username)
                cpMsgParts.push(`<div style="margin-bottom: 0.5rem;">You have moved to ${userData.locationP}.</div>`);
            } else if (cpStat === "LEVEL") {
                if (cp) {
                    await addCP(cpReward[i+2], cpGain, username, false, result, true);
                }
                userData = await getUserData(username)
                cpMsgParts.push(`<div style="margin-bottom: 0.5rem;">You have gained ${cpGain} levels of ${cpReward[i+2]}.</div>`);
                i++
            } else if (cpStat === "item") {
                if (cp) {
                    await addCP(cpReward[i+2], cpGain, username, true, result);
                }
                [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
                userData = rows[0];
                if (cpGain > 0) {
                    cpMsgParts.push(`<div style="margin-bottom: 0.5rem;">You have gained ${cpGain} ${cpReward[i+2]}. (You now have ${userData.items[cpReward[i+2]]} ${cpReward[i+2]})</div>`);
                } else {
                    cpMsgParts.push(`<div style="margin-bottom: 0.5rem;">You have lost ${cpGain - cpGain * 2} ${cpReward[i+2]}. (You now have ${userData.items[cpReward[i+2]]} ${cpReward[i+2]})</div>`);
                }
                i++;
            } else {
                const prevLevel = userData.qualities[cpStat] || 0;
                const prevCP = userData.cp[cpStat] || 0;
                if (prevLevel == 0 && prevCP == 0 && cpGain < 1) {continue;}
                if (cp) {
                    await addCP(cpStat, cpGain, username, false, result);
                }
                userData = await getUserData(username)
                const newLevel = userData.qualities[cpStat];
                const newCP = userData.cp[cpStat];
                const levelsGained = newLevel - prevLevel;
                let sign = ""
                if (cpGain > 0) {
                    sign = "+"
                }
                cpMsgParts.push(`
                    <div style="margin-bottom: 0.5rem;">
                        <strong>${cpStat}</strong>: ${sign}${cpGain} CP<br>
                        Level: ${newLevel} ${levelsGained > 0 ? `(+${levelsGained} level${levelsGained > 1 ? 's' : ''})` : ''}<br>
                        <progress value="${newCP}" max="${newLevel + 1}"></progress>
                    </div>`);
            }
        }
        cpMsg = `<div style="color: black;">${cpMsgParts.join('')}</div>`;
    }
    //renderQualities();
    bordered = ``
    // Decide which button to show
    let buttonHTML = '';
    if (showBack) {
        buttonHTML = `<button type="button" id="backBtn">Back</button>`;
    } else {
        buttonHTML = `<button type="button" id="continueBtn">Continue</button>`;
    }
    let resultBox = ''
    if (qualityKey !== null) {
        resultBox = `
            <div class="box result-box ${result === 0 ? 'success' : 'failure'}">
                <p style="color:black"><strong>${result === 0 ? 'Success' : 'Failure'}:</strong> You ${result === 0 ? 'succeeded' : 'failed'} due to your <em>${qualityKey}</em>.</p>
                ${cpMsg}
            </div>`;
    } else if (cpMsg !== "") {
        resultBox = `
            <div class="box result-box success">
                <p>${cpMsg}</p>
            </div>`;
    }
    bordered = `
        <div class="box">
            <div class="info">
                <h2>${title}</h2>
                <p>${text}</p>
                ${buttonHTML}
            </div>
        </div>
        ${resultBox}
    `;

    const idToGo = nextId !== undefined ? nextId : (previousId !== undefined ? previousId : 0);
    return [idToGo, bordered, showBack, nextIsMultiple];
}
async function getUserData(username) {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    return rows[0];
}
app.post('/api/login', async (req, res) => {
    const {username, password} = req.body;
    try {
        const [rows] = await pool.query('SELECT password_hash FROM users WHERE username = ?', [username]);
        if (rows.length === 0) {
            return res.status(401).json({message: 'Invalid credentials'});
        }

        const valid = await bcrypt.compare(password, rows[0].password_hash);
        if (!valid) {
            return res.status(401).json({message: 'Invalid credentials'});
        }
        res.clearCookie('user');
        res.cookie('user', username, {
            httpOnly: true,
            signed: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 86400000
        });
        res.json({success: true});
    } catch (err) {
        console.error(err);
        res.status(500).json({message: 'Internal server error'});
    }
});


app.get('/api/check-auth', (req, res) => {
    const user = req.signedCookies.user;
    if (user) {
        res.json({loggedIn: true, user});
    } else {
        res.json({loggedIn: false});
    }
});

app.get("action-time", async (req, res) => {
    const user = req.signedCookies.user;
    userData = getUserData()
    if (user) {
        const current = 0; //! Get current time
        const seconds = userData.time
        //const secondsElapsed = current -
        const actionGiven = secondsElapsed / 300 + userData.actions;
        res.json({actions:actionGiven})
        await pool.query('UPDATE users SET action = ? WHERE username = ?', [actionsGiven, username])
    } else {
        return res.status(401).json({error: 'Not logged in'})
    }
})
// Logout
app.post('/api/logout', (_req, res) => {
    res.clearCookie('user');
    res.json({success: true});
});
app.post('/api/get-screen', async (req, res) => {
    const {multiple, screenId, desc=null, multipleId=null, cp=true} = req.body;
    const username = req.signedCookies.user;
    if (!username) return res.status(401).json({error: 'Not logged in'});
    userData = await getUserData(username)
    const actions = userData.action;
    let actionsChange = 0
    if (cp) {
        actionsChange = actions - 1;
    } else {
        actionsChange = actions;
    }
    const locationP = userData.locationP;
    if (multiple) {
        res.json({message: await renderMultiple(screenId, false, username), loc: locationP, id:screenId, cp:cp, actions:actionsChange});
        await pool.query('UPDATE users SET location = ?, multiple = ? WHERE username = ?', [screenId, true, username]);
    } else {
        if (desc === null || multipleId === null) {
            res.status(400).json({error:"No desc or multipleId?"})
        } else {
            res.json({message: await attemptScreen(screenId, desc, multipleId, username, cp), loc:locationP, desc:desc, actions:actionsChange});
            await pool.query('UPDATE users SET location = ?, multiple = ?, descrip = ?, prev = ?, action = ? WHERE username = ?', [screenId, false, desc, multipleId, actionsChange, username]);
        }
    }
});

app.post('/api/get-loc', async (req, res) => {
    const username = req.signedCookies.user;
    if (!username) return res.status(401).json({error: 'Not logged in (Perhaps your session expired?)'});
    userData = await getUserData(username)
    res.json({loc:userData.locationP});
});

app.post('/api/render-screen', async (req, res) => {
    const {screenId} = req.body;
    const username = req.signedCookies.user;
    if (!username) return res.status(401).json({error: 'Not logged in (Perhaps your session expired?)'});
    [rows] = await pool.query('SELECT locationP FROM users WHERE username = ?', [username]);
    const locationP = rows[0];
    res.json({message: renderScreen(screenId, username, userData.location), loc:locationP});
});

app.post('/api/get-qualities', async (req, res) => {
    const username = req.signedCookies.user;
    if (!username) return res.status(401).json({error: 'Not logged in (Perhaps your session expired?)'});
    userData = await getUserData(username)
    res.json({qualities:userData.qualities, items:userData.items, Q:importantQ, cp:userData.cp});
});

app.post('/api/get-last', async (req, res) => {
    const username = req.signedCookies.user;
    if (!username) return res.status(401).json({error: 'Not logged in (Perhaps your session expired?)'});
    userData = await getUserData(username)
    res.json({location:userData.location, multiple:userData.multiple, desc:userData.descrip, prevId:userData.prev});
});

app.post('/api/delete-account', async (req, res) => {
    const username = req.signedCookies.user;
    if (!username) return res.status(401).json({error: 'Not logged in (Perhaps your session expired?)'});
    userData = await getUserData(username)
    res.json({location:userData.location, multiple:userData.multiple, desc:userData.descrip, prevId:userData.prev});
});

app.post('/api/change', async (req, res) => {
    const {type, value} = req.body;
    const username = req.signedCookies.user;
    if (!username) return res.status(401).json({error: 'Not logged in (Perhaps your session expired?)'});
    switch (type) {
        case "password":
            if (value.length > 44) {
                res.sendStatus(413);
            }
            const newHash = await bcrypt.hash(value, saltRounds);
            await pool.query('UPDATE users SET password_hash = ? WHERE username = ?', [newHash, username]);
            res.sendStatus(200);
            break;
        case "username":
            if (value.length > 44) {
                res.sendStatus(413);
            }
            const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [value]);
            if (rows.length > 0) {
                return res.status(409).json({error: 'Username already exists'});
            }
            await pool.query('UPDATE users SET username = ? WHERE username = ?', [value, username]);
            res.sendStatus(200);
            break;
        case "delete":
            if (value === "DELETE") {
                await pool.query('DELETE FROM users WHERE username = ?', [username]);
                res.clearCookie('user')
                res.sendStatus(200);
            } else {
                res.status(400).json({error: 'Did not type DELETE.', request:value});
            }
            break;
        default:
            res.status(400).json({error: 'Unknown type for change.', type:type});
    }
});

app.post('/api/create-account', async (req, res) => {
    const {username, password} = req.body;
    if (username.length > 44 || password.length > 44) {
        return res.status(413).json({'message':"Your username and password must be below 45 characters each."});
    }
    try {
    // Check if username already exists
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length > 0) {
        return res.status(409).json({message: 'Username already exists'});
    }
    // Hash the password
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Insert user
    await pool.query('INSERT INTO users (username, password_hash, qualities, location, multiple, cp, items, locationP) VALUES (?, ?, ?, 0, true, ?, ?, ?)', [username, password_hash, JSON.stringify(qualities.qualities), JSON.stringify({}), JSON.stringify({"Sovereigns":5}), "Syphontion"]);

    res.json({success: true});
    } catch (err) {
    console.error(err);
    res.status(500).json({message: 'Internal server error'});
    }
});
// Pages
app.get('', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/game', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

app.get('/settings', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.use((_req, res, _next) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});