let intervals = [];
const game = (() => {
    function renderMultiple(multipleId, addCP=true) {
        fetch(`http://localhost:8080/api/get-screen`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({multiple:true, screenId:multipleId, desc:null, multipleId:null, cp:addCP})
            })
        .then(res => res.json())
        .then(data => {
            document.getElementById("location").textContent = `You are currently in ${data["loc"]}.`
            document.getElementById("actions").textContent = `Actions: ${data["actions"]}/20`
            const bordered = document.querySelector('.main');
            bordered.innerHTML = '';
            const title = document.createElement('div');
            title.innerHTML = data["message"]["in"];
            bordered.appendChild(title);
            for (let idx = 0; idx < Object.keys(data["message"]["op"]).length; idx++) {
                let opt = data["message"]["op"][idx]
                const box = document.createElement('div');
                box.className = 'box';
                box.innerHTML = data["message"]["bor"][idx];
                bordered.appendChild(box);
                if (!opt.isLocked) {
                    const btn = box.querySelector('button');
                    btn.addEventListener('click', () => {
                        if (opt.multiple) {
                            renderMultiple(opt.screenId);
                        } else {
                            attemptScreen(opt.screenId, opt.title, data["id"]);
                        }
                    });
                } else {
                    box.className = "locked box"
                }
            }
            const glitchEl = document.querySelectorAll(".glitch");
            for (const i of intervals) {
                clearInterval(i);
            }
            intervals = []
            if (glitchEl.length === 0) {} else {
                intervals.push(setInterval(() => {
                    glitchEl.forEach(el => {
                        el.textContent = randomLetters(5);
                    })
                }, 75)); // speed in ms
            }
        });
        renderQualities();
    }

    function renderQualities() {
        const container = document.getElementById('qualitiesBox');
        const search = document.getElementById('qualitySearch').value.toLowerCase();
        const QI = document.getElementById('qi').value;
        container.innerHTML = ''; // Clear old list
        let entries = ""
        fetch(`http://localhost:8080/api/get-qualities`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
            })
        .then(res => res.json())
        .then(data => {
            if (QI === "qualities") {
                entries = Object.entries(data["qualities"])
                .filter(([stat]) => stat.toLowerCase().includes(search)) // filter
                .sort((a, b) => {
                    const importantA = data["Q"].includes(a[0]);
                    const importantB = data["Q"].includes(b[0]);

                    if (importantA && !importantB) return -1;
                    if (!importantA && importantB) return 1;

                    return a[0].localeCompare(b[0]);
                });
            } else {
                entries = Object.entries(data["items"])
                .filter(([stat]) => stat.toLowerCase().includes(search)) // filter
                .sort((a, b) => {
                    const importantA = data["Q"].includes(a[0]);
                    const importantB = data["Q"].includes(b[0]);

                    if (importantA && !importantB) return -1;
                    if (!importantA && importantB) return 1;
                    return a[0].localeCompare(b[0]);
                });
            }
            for (const [stat, level] of entries) {
                if (level === 0) {
                    continue;
                }
                let qualityDiv = ""
                if (QI === "qualities") {
                    const cpProgress = data["cp"][stat] || 0;

                    qualityDiv = document.createElement('div');
                    qualityDiv.className = 'quality';
                    qualityDiv.innerHTML = `
                        <p style="margin:0px; padding:0px; margin-top:5px;">
                            <strong>${stat}</strong> — Level ${level}<span style="font-size: 0.85em;"> (${cpProgress}/${level + 1} CP)</span>
                        </p>
                        <progress value="${cpProgress}" max="${level + 1}"></progress>
                    `;
                } else {
                    displayLevel = level;
                    const currencySymbols = {
                        "Sovereigns": "$",
                        "Credits": "₡",
                        "Wearian Coinage": "₩"
                    };

                    if (currencySymbols[stat]) {
                        displayLevel = `${currencySymbols[stat]}${Number(level).toFixed(2)}`;
                    }
                    qualityDiv = document.createElement('div');
                    qualityDiv.className = 'quality';
                    qualityDiv.innerHTML = `<p style="margin:0px; padding:0px; margin-top:5px;"><strong>${stat}</strong> — ${displayLevel}<span style="font-size: 0.85em;"></span></p>`;
                }
                container.appendChild(qualityDiv);
            }
        });
    }

    function attemptScreen(screenId, desc, multipleId, cp=true) {
        fetch(`http://localhost:8080/api/get-screen`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({multiple:false, screenId:screenId, desc:desc, multipleId, cp})
            })
        .then(res => res.json())
        .then(data => {
            document.getElementById("actions").textContent = `Actions: ${data["actions"]}/20`
            renderQualities();
            const bordered = document.querySelector('.main');
            bordered.innerHTML = data["message"][1];
            attachBackgroundListeners(data["message"][2], data["message"][3], data["message"][0]);
        });
    }



    function renderScreen(screenId) {
        fetch(`http://localhost:8080/api/render-screen`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({screenId:screenId})
        })
        .then(res => res.json())
        .then(data => {
            const bordered = document.querySelector('.bordered');
            bordered.innerHTML = data["message"][0];
            attachBackgroundListeners(data["message"][3], data["message"][1], data["message"][2]);
        });
    }
    function attachBackgroundListeners(data1, data2, data3) {
        if (data1) {
            document.getElementById('backBtn').addEventListener('click', () => {
                if (data2) {
                    renderMultiple(data3);
                } else {
                    renderScreen(data3);
                }
            });
        } else {
            document.getElementById('continueBtn').addEventListener('click', () => {
                if (data2) {
                    renderMultiple(data3);
                } else {
                    renderScreen(data3);
                }
            });
        }
    }
    function randomLetters(length) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()[]{}<>?/|\\`¡™£¢∞§¶•ªº≠œ∑´®†¥¨ˆøπaß∂ƒ©˙∆˚¬…≈ç√∫˜µµ≤≥÷";
        let out = "";
        for (let i = 0; i < length; i++) {
            out += chars[Math.floor(Math.random() * chars.length)];
        }
        return out;
    }
    function init() {
        fetch(`http://localhost:8080/api/get-last`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
        }).then(res => res.json()).then(data => {
            if (data["multiple"]) {
                    renderMultiple(data["location"], false)
            } else {
                attemptScreen(data["location"], data["desc"], data["prevId"], false)
            }
        });
}

    return { // Public functions
        init,
        renderQualities,
    }
})();
//const DEBUG = false
fetch(`http://localhost:8080/api/get-loc`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
}).then(res => res.json()).then(data => {
document.getElementById("location").textContent = `You are currently in ${data["loc"]}.`});
game.init()
document.getElementById('qualitySearch').addEventListener('input', game.renderQualities);
document.getElementById('qi').addEventListener('change', game.renderQualities);
