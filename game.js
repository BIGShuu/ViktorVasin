'use strict';

// ===========================
// КОНСТАНТЫ
// ===========================
const CARD_DEFS = [
    { id:'vasin',    name:'Васин №5',  cost:4, atk:4, hp:12, read:9, tea:2, taunt:true },
    { id:'ramos',    name:'Рамос',      cost:4, atk:5, hp:7,  read:6, tea:1, ability:'ramos' },
    { id:'messi',    name:'Месси',      cost:6, atk:7, hp:5,  read:10,tea:1, rush:true },
    { id:'ronaldo',  name:'Роналду',    cost:6, atk:8, hp:6,  read:7, tea:1, ability:'ronaldo' },
    { id:'leo',      name:'Лео',        cost:5, atk:6, hp:8,  read:8, tea:1, ability:'leo' },
    { id:'durden',   name:'Дёрден',     cost:3, atk:6, hp:4,  read:5, tea:0, ability:'durden' },
    { id:'clark',    name:'Кларк',      cost:2, atk:2, hp:3,  read:7, tea:1, ability:'clark' },
    { id:'mishanya', name:'Мишаня',     cost:1, atk:2, hp:3,  read:4, tea:1, ability:'mishanya' },
    { id:'daniyar',  name:'Данияр',     cost:1, atk:2, hp:4,  read:6, tea:0, ability:'daniyar' },
    { id:'tisha',    name:'Тиша',       cost:2, atk:1, hp:6,  read:3, tea:2, taunt:true },
    { id:'timur',    name:'Тимур',      cost:1, atk:2, hp:1,  read:5, tea:0, rush:true },
    { id:'denis',    name:'Денис',      cost:2, atk:3, hp:3,  read:6, tea:1, ability:'denis' },
    { id:'asya',     name:'Ася',        cost:1, atk:1, hp:3,  read:4, tea:1, ability:'asya' },
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ===========================
// СОСТОЯНИЕ
// ===========================
let G;

function newState() {
    return {
        turn: 0,
        current: 'player',
        player:    { hp:30, maxHp:30, mana:0, maxMana:0, hand:[], field:[], deck:[], fatigue:0 },
        opponent:  { hp:30, maxHp:30, mana:0, maxMana:0, hand:[], field:[], deck:[], fatigue:0 },
        selected: null,
        gameOver: false,
        busy: false,
        uid: 0,
    };
}

function nextUid() { return ++G.uid; }

// ===========================
// УТИЛИТЫ
// ===========================
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function log(msg) {
    let el = document.getElementById('log');
    if (!el) return;
    let div = document.createElement('div');
    div.textContent = msg;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
}

// ===========================
// КОЛОДА
// ===========================
function makeCard(def) {
    return {
        uid: nextUid(),
        id: def.id,
        name: def.name,
        cost: def.cost,
        atk: def.atk,
        hp: def.hp,
        maxHp: def.hp,
        read: def.read,
        tea: def.tea,
        taunt: !!def.taunt,
        rush: !!def.rush,
        ability: def.ability || null,
        sleeping: true,
        frozen: false,
        attacked: false,
        bonusAtk: 0,
        bonusHp: 0,
    };
}

function makeDeck() {
    let deck = [];
    for (let def of CARD_DEFS) {
        deck.push(makeCard(def));
        deck.push(makeCard(def));
    }
    return shuffle(deck);
}

function draw(side) {
    let s = G[side];
    if (s.deck.length === 0) {
        s.fatigue++;
        s.hp -= s.fatigue;
        log(`${side === 'player' ? '☕ Васин' : '🎲 Кларк'}: усталость ${s.fatigue}!`);
        return null;
    }
    if (s.hand.length >= 7) {
        let burned = s.deck.pop();
        log(`${burned.name} сгорает — рука полна!`);
        return null;
    }
    let card = s.deck.pop();
    s.hand.push(card);
    return card;
}

// ===========================
// ЭФФЕКТИВНЫЕ СТАТЫ
// ===========================
function effAtk(card, side) {
    let a = card.atk + card.bonusAtk;
    if (card.id === 'daniyar') {
        if (G[side].field.some(c => c.id === 'vasin' && c.uid !== card.uid)) {
            a += 2;
        }
    }
    return a;
}

function effTaunt(card, side) {
    if (card.id === 'denis') {
        return !G[side].field.some(c => c.id === 'vasin' && c.uid !== card.uid);
    }
    return card.taunt;
}

function effMaxHp(card) {
    return card.maxHp + card.bonusHp;
}

// ===========================
// ИГРА КАРТЫ
// ===========================
function playCard(side, handIdx) {
    let s = G[side];
    let card = s.hand[handIdx];
    if (!card || card.cost > s.mana || s.field.length >= 5) return false;

    s.mana -= card.cost;
    s.hand.splice(handIdx, 1);
    card.sleeping = !card.rush;
    card.frozen = false;
    card.attacked = false;
    s.field.push(card);

    let prefix = side === 'player' ? '' : '🤖 ';
    log(`${prefix}${card.name} выходит (⚔${card.atk} 🛡${card.hp})`);

    battlecry(card, side);
    return true;
}

function battlecry(card, side) {
    let enemy = side === 'player' ? 'opponent' : 'player';
    switch (card.ability) {
        case 'ramos':
            for (let c of G[side].field) {
                if (c.uid !== card.uid) {
                    c.bonusHp += 1;
                    c.hp += 1;
                }
            }
            log(`🛡 Рамос: +1 HP союзникам`);
            break;
        case 'leo': {
            let targets = G[enemy].field.filter(c => !c.frozen);
            if (targets.length > 0) {
                let t = targets[Math.floor(Math.random() * targets.length)];
                t.frozen = true;
                log(`❄️ Лео замораживает ${t.name}!`);
            }
            break;
        }
        case 'clark':
            draw(side);
            log(`🃏 Кларк: дополнительная карта`);
            break;
        case 'mishanya':
            if (Math.random() < 0.5) {
                card.bonusAtk += 3;
                log(`🪙 Мишаня: монетка → +3⚔!`);
            } else {
                card.bonusHp += 3;
                card.hp += 3;
                log(`🪙 Мишаня: монетка → +3🛡!`);
            }
            break;
        case 'asya': {
            let before = G[side].hp;
            G[side].hp = Math.min(G[side].maxHp, G[side].hp + 2);
            let healed = G[side].hp - before;
            if (healed > 0) log(`💚 Ася: герою +${healed} HP`);
            break;
        }
    }
}

// ===========================
// БОЙ
// ===========================
function getLegalTargets(attackerSide) {
    let enemy = attackerSide === 'player' ? 'opponent' : 'player';
    let taunts = G[enemy].field.filter(c => effTaunt(c, enemy));
    if (taunts.length > 0) return taunts;
    return [...G[enemy].field];
}

function canAttackHero(attackerSide) {
    let enemy = attackerSide === 'player' ? 'opponent' : 'player';
    return !G[enemy].field.some(c => effTaunt(c, enemy));
}

async function doAttack(attackerUid, targetUid) {
    let atkSide = G.current;
    let defSide = atkSide === 'player' ? 'opponent' : 'player';

    let attacker = G[atkSide].field.find(c => c.uid === attackerUid);
    let target = G[defSide].field.find(c => c.uid === targetUid);
    if (!attacker || !target) return;

    attacker.attacked = true;

    let atkDmg = effAtk(attacker, atkSide);
    let defDmg = effAtk(target, defSide);

    // Определяем порядок ударов
    let atkFirst = false;
    if (attacker.id === 'messi') {
        atkFirst = true; // Месси всегда бьёт первым
    } else if (attacker.read > target.read) {
        atkFirst = true;
    }

    // Анимация
    await animAttack(attackerUid, targetUid);

    let prefix = atkSide === 'player' ? '' : '🤖 ';
    log(`${prefix}${attacker.name} ⚔ ${target.name}`);

    if (atkFirst) {
        // Атакующий бьёт первым
        target.hp -= atkDmg;
        showFloatDmg(targetUid, -atkDmg);
        await sleep(350);

        if (target.hp <= 0) {
            log(`💀 ${target.name} погиб!`);
            await animDeath(targetUid);
            removeCard(defSide, targetUid);
            render();
            await deathrattle(target, defSide);
        } else {
            // Ответный удар
            attacker.hp -= defDmg;
            showFloatDmg(attackerUid, -defDmg);
            await sleep(350);

            if (attacker.hp <= 0) {
                log(`💀 ${attacker.name} погиб!`);
                await animDeath(attackerUid);
                removeCard(atkSide, attackerUid);
                render();
                await deathrattle(attacker, atkSide);
            }
        }
    } else {
        // Одновременный урон
        target.hp -= atkDmg;
        attacker.hp -= defDmg;
        showFloatDmg(targetUid, -atkDmg);
        showFloatDmg(attackerUid, -defDmg);
        await sleep(400);

        let targetDead = target.hp <= 0;
        let attackerDead = attacker.hp <= 0;

        if (targetDead) {
            log(`💀 ${target.name} погиб!`);
            await animDeath(targetUid);
            removeCard(defSide, targetUid);
        }
        if (attackerDead) {
            log(`💀 ${attacker.name} погиб!`);
            await animDeath(attackerUid);
            removeCard(atkSide, attackerUid);
        }
        render();

        if (targetDead) await deathrattle(target, defSide);
        if (attackerDead) await deathrattle(attacker, atkSide);
    }

    render();
    checkWin();
}

async function doAttackHero(attackerUid) {
    let atkSide = G.current;
    let defSide = atkSide === 'player' ? 'opponent' : 'player';

    let attacker = G[atkSide].field.find(c => c.uid === attackerUid);
    if (!attacker) return;

    attacker.attacked = true;

    let atkDmg = effAtk(attacker, atkSide);
    if (attacker.id === 'ronaldo') atkDmg += 3;

    await animAttackHero(attackerUid, defSide);

    G[defSide].hp -= atkDmg;
    showFloatDmgHero(defSide, -atkDmg);

    let prefix = atkSide === 'player' ? '' : '🤖 ';
    let rBonus = attacker.id === 'ronaldo' ? ' (+3⚔)' : '';
    log(`${prefix}${attacker.name} ⚔ герою${rBonus}: -${atkDmg} HP`);

    await sleep(400);
    render();
    checkWin();
}

async function deathrattle(card, side) {
    let enemy = side === 'player' ? 'opponent' : 'player';
    if (card.id === 'durden') {
        let targets = G[enemy].field;
        if (targets.length > 0) {
            let t = targets[Math.floor(Math.random() * targets.length)];
            t.hp -= 7;
            log(`💥 Дёрден: 7 урона ${t.name}!`);
            showFloatDmg(t.uid, -7);
            await sleep(400);
            if (t.hp <= 0) {
                log(`💀 ${t.name} погиб от взрыва!`);
                await animDeath(t.uid);
                removeCard(enemy, t.uid);
                render();
            }
        } else {
            G[enemy].hp -= 7;
            log(`💥 Дёрден: 7 урона герою!`);
            showFloatDmgHero(enemy, -7);
            await sleep(400);
            render();
            checkWin();
        }
    }
}

function removeCard(side, uid) {
    G[side].field = G[side].field.filter(c => c.uid !== uid);
}

// ===========================
// ХОД
// ===========================
function startTurn(side) {
    G.current = side;
    let s = G[side];

    // Мана
    s.maxMana = Math.min(10, s.maxMana + 1);
    s.mana = s.maxMana;

    // Разморозка и пробуждение
    for (let c of s.field) {
        if (c.frozen) {
            c.frozen = false;
            c.sleeping = true; // Заморозка = пропуск атаки
        } else {
            c.sleeping = false;
        }
        c.attacked = false;
    }

    // Чай (☕) — самолечение
    for (let c of s.field) {
        if (c.tea > 0) {
            let maxHp = effMaxHp(c);
            let healed = Math.min(c.tea, maxHp - c.hp);
            if (healed > 0) {
                c.hp += healed;
            }
        }
    }

    // Берём карту
    draw(side);
    G.selected = null;
}

function checkWin() {
    if (G.player.hp <= 0) {
        G.gameOver = true;
        G.player.hp = 0;
        showBanner('Кларк победил! 🎲💀');
        document.getElementById('btn-new').hidden = false;
        render();
        return true;
    }
    if (G.opponent.hp <= 0) {
        G.gameOver = true;
        G.opponent.hp = 0;
        showBanner('Васин победил! ☕⚽🏆');
        confetti();
        document.getElementById('btn-new').hidden = false;
        render();
        return true;
    }
    return false;
}

// ===========================
// ИИ
// ===========================
async function aiTurn() {
    startTurn('opponent');
    render();
    await showBanner('Ход Кларка 🎲');
    await sleep(600);

    // Играем карты (жадно: самые дорогие сначала)
    let played = true;
    while (played && !G.gameOver) {
        played = false;
        if (G.opponent.field.length >= 5) break;

        let best = -1, bestCost = -1;
        for (let i = 0; i < G.opponent.hand.length; i++) {
            let c = G.opponent.hand[i];
            if (c.cost <= G.opponent.mana && c.cost > bestCost) {
                best = i;
                bestCost = c.cost;
            }
        }

        if (best >= 0) {
            playCard('opponent', best);
            render();
            await sleep(500);
            played = true;
            if (checkWin()) return;
        }
    }

    // Атакуем
    for (let card of [...G.opponent.field]) {
        if (G.gameOver) return;
        if (!G.opponent.field.includes(card)) continue;
        if (card.sleeping || card.frozen || card.attacked) continue;

        let targets = getLegalTargets('opponent');
        let heroOk = canAttackHero('opponent');

        // Роналду: леталка по герою
        if (card.id === 'ronaldo' && heroOk) {
            let dmg = effAtk(card, 'opponent') + 3;
            if (dmg >= G.player.hp) {
                G.busy = true;
                await doAttackHero(card.uid);
                if (G.gameOver) return;
                continue;
            }
        }

        if (targets.length > 0) {
            // Ищем летальную цель
            let lethal = targets.filter(t => t.hp <= effAtk(card, 'opponent'));
            if (lethal.length > 0) {
                // Атакуем самую опасную (наибольший ⚔)
                lethal.sort((a, b) => effAtk(b, 'opponent') - effAtk(a, 'opponent'));
                G.busy = true;
                await doAttack(card.uid, lethal[0].uid);
            } else if (heroOk) {
                G.busy = true;
                await doAttackHero(card.uid);
            } else {
                // Атакуем наименьшего таунта
                targets.sort((a, b) => a.hp - b.hp);
                G.busy = true;
                await doAttack(card.uid, targets[0].uid);
            }
        } else if (heroOk) {
            G.busy = true;
            await doAttackHero(card.uid);
        }

        await sleep(350);
        if (G.gameOver) return;
    }

    // Конец хода ИИ → начало хода игрока
    await sleep(300);
    startTurn('player');
    render();
    await showBanner('Ваш ход ☕');
    G.busy = false;
    render();
}

// ===========================
// РЕНДЕР
// ===========================
function render() {
    renderHero('player');
    renderHero('opponent');
    renderHand('player');
    renderHand('opponent');
    renderField('player');
    renderField('opponent');

    document.getElementById('pl-deck').textContent = G.player.deck.length;
    document.getElementById('opp-deck').textContent = G.opponent.deck.length;

    let btn = document.getElementById('btn-end');
    btn.disabled = G.busy || G.current !== 'player' || G.gameOver;
}

function renderHero(side) {
    let s = G[side];
    let el = document.getElementById(side === 'player' ? 'pl-hero' : 'opp-hero');
    let name = side === 'player' ? '☕ Васин' : '🎲 Кларк';
    el.innerHTML = `
        <div class="hero-name">${name}</div>
        <div class="hero-hp">❤️${s.hp}/${s.maxHp}</div>
        <div class="hero-mana">⚡${s.mana}/${s.maxMana}</div>
    `;

    if (side === 'opponent' && G.selected && !G.busy && canAttackHero('player')) {
        el.classList.add('targetable');
    } else {
        el.classList.remove('targetable');
    }
}

function renderHand(side) {
    let el = document.getElementById(side === 'player' ? 'pl-hand' : 'opp-hand');
    let s = G[side];
    el.innerHTML = '';

    for (let i = 0; i < s.hand.length; i++) {
        let card = s.hand[i];
        let div = document.createElement('div');

        if (side === 'opponent') {
            div.className = 'card opp-card in-hand';
            div.innerHTML = `<div class="cost">${card.cost}</div>`;
        } else {
            let playable = !G.busy && G.current === 'player' && !G.gameOver
                && card.cost <= s.mana && s.field.length < 5;
            div.className = 'card in-hand' + (playable ? ' playable' : '');
            div.innerHTML = `
                <div class="cost">${card.cost}</div>
                <div class="name">${card.name}</div>
                <div class="mid-stats">👁${card.read} ☕${card.tea}</div>
                <div class="stats">
                    <span class="atk">⚔${card.atk}</span>
                    <span class="hp">🛡${card.hp}</span>
                </div>
            `;
            if (playable) {
                div.onclick = () => onPlayCard(i);
            }
        }

        el.appendChild(div);
    }
}

function renderField(side) {
    let el = document.getElementById(side === 'player' ? 'pl-field' : 'opp-field');
    let s = G[side];
    el.innerHTML = '';

    for (let card of s.field) {
        let div = document.createElement('div');
        let classes = ['card'];

        let isOwn = (side === G.current);
        let ea = effAtk(card, side);
        let et = effTaunt(card, side);

        if (et) classes.push('taunt');
        if (card.frozen) classes.push('frozen');
        if (card.sleeping && isOwn) classes.push('sleeping');

        // Подсветка для игрока
        if (side === 'player' && G.current === 'player' && !G.busy && !G.gameOver) {
            if (G.selected === card.uid) {
                classes.push('selected');
            } else if (!card.sleeping && !card.frozen && !card.attacked) {
                classes.push('can-attack');
            }
        }

        // Подсветка целей для противника
        if (side === 'opponent' && G.selected && !G.busy) {
            let targets = getLegalTargets('player');
            if (targets.some(t => t.uid === card.uid)) {
                classes.push('targetable');
            }
        }

        div.className = classes.join(' ');
        div.dataset.uid = card.uid;

        let hpClass = card.hp < effMaxHp(card) ? 'hp damaged' : 'hp';
        let bonusTxt = card.bonusHp > 0 ? `+${card.bonusHp}` : '';

        div.innerHTML = `
            <div class="cost">${card.cost}</div>
            <div class="name">${card.name}</div>
            <div class="mid-stats">👁${card.read} ☕${card.tea}</div>
            <div class="stats">
                <span class="atk">⚔${ea}</span>
                <span class="${hpClass}">🛡${card.hp}${bonusTxt ? ' ' + bonusTxt : ''}</span>
            </div>
        `;

        // Клики
        if (side === 'player' && G.current === 'player' && !G.busy && !G.gameOver) {
            if (!card.sleeping && !card.frozen && !card.attacked) {
                div.onclick = () => onSelectAttacker(card.uid);
            }
        }
        if (side === 'opponent' && G.selected && !G.busy) {
            let targets = getLegalTargets('player');
            if (targets.some(t => t.uid === card.uid)) {
                div.onclick = () => onAttackTarget(card.uid);
            }
        }

        el.appendChild(div);
    }
}

// ===========================
// АНИМАЦИИ
// ===========================
async function animAttack(atkUid, tgtUid) {
    let atkEl = document.querySelector(`[data-uid="${atkUid}"]`);
    let tgtEl = document.querySelector(`[data-uid="${tgtUid}"]`);

    if (atkEl) {
        let isPlayerAtk = !!document.querySelector(`#pl-field [data-uid="${atkUid}"]`);
        atkEl.classList.add(isPlayerAtk ? 'anim-lunge-up' : 'anim-lunge-down');
    }
    await sleep(200);
    if (tgtEl) tgtEl.classList.add('anim-hit');
    await sleep(300);
    if (atkEl) atkEl.classList.remove('anim-lunge-up', 'anim-lunge-down');
    if (tgtEl) tgtEl.classList.remove('anim-hit');
}

async function animAttackHero(atkUid, defSide) {
    let atkEl = document.querySelector(`[data-uid="${atkUid}"]`);
    let heroEl = document.getElementById(defSide === 'player' ? 'pl-hero' : 'opp-hero');

    if (atkEl) {
        let isPlayerAtk = !!document.querySelector(`#pl-field [data-uid="${atkUid}"]`);
        atkEl.classList.add(isPlayerAtk ? 'anim-lunge-up' : 'anim-lunge-down');
    }
    await sleep(200);
    if (heroEl) heroEl.classList.add('anim-hit');
    await sleep(300);
    if (atkEl) atkEl.classList.remove('anim-lunge-up', 'anim-lunge-down');
    if (heroEl) heroEl.classList.remove('anim-hit');
}

async function animDeath(uid) {
    let el = document.querySelector(`[data-uid="${uid}"]`);
    if (el) el.classList.add('anim-dying');
    await sleep(500);
}

function showFloatDmg(uid, amount) {
    let el = document.querySelector(`[data-uid="${uid}"]`);
    if (!el) return;
    let rect = el.getBoundingClientRect();
    let span = document.createElement('span');
    span.className = 'float-dmg' + (amount > 0 ? ' float-heal' : '');
    span.textContent = amount > 0 ? `+${amount}` : amount;
    span.style.left = (rect.left + rect.width / 2 - 12) + 'px';
    span.style.top = (rect.top + rect.height / 3) + 'px';
    document.body.appendChild(span);
    setTimeout(() => span.remove(), 900);
}

function showFloatDmgHero(side, amount) {
    let el = document.getElementById(side === 'player' ? 'pl-hero' : 'opp-hero');
    if (!el) return;
    let rect = el.getBoundingClientRect();
    let span = document.createElement('span');
    span.className = 'float-dmg' + (amount > 0 ? ' float-heal' : '');
    span.textContent = amount > 0 ? `+${amount}` : amount;
    span.style.left = (rect.left + rect.width / 2 - 12) + 'px';
    span.style.top = (rect.top + rect.height / 3) + 'px';
    document.body.appendChild(span);
    setTimeout(() => span.remove(), 900);
}

async function showBanner(text) {
    let el = document.getElementById('banner');
    el.textContent = text;
    el.hidden = false;
    // Перезапуск анимации
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = '';
    await sleep(900);
    el.hidden = true;
}

function confetti() {
    let box = document.getElementById('confetti-box');
    box.innerHTML = '';
    let colors = ['#f44','#4f4','#44f','#ff4','#f4f','#4ff','#fa4','#a4f','#4fa','#f4a'];
    for (let i = 0; i < 80; i++) {
        let div = document.createElement('div');
        div.className = 'confetti';
        div.style.left = Math.random() * 100 + 'vw';
        div.style.background = colors[Math.floor(Math.random() * colors.length)];
        div.style.animationDelay = Math.random() * 2 + 's';
        div.style.animationDuration = (2.5 + Math.random() * 2) + 's';
        div.style.width = (6 + Math.random() * 10) + 'px';
        div.style.height = (6 + Math.random() * 10) + 'px';
        div.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        box.appendChild(div);
    }
    setTimeout(() => box.innerHTML = '', 5000);
}

// ===========================
// ОБРАБОТЧИКИ
// ===========================
function onPlayCard(handIdx) {
    if (G.busy || G.current !== 'player' || G.gameOver) return;
    let card = G.player.hand[handIdx];
    if (!card || card.cost > G.player.mana || G.player.field.length >= 5) return;

    playCard('player', handIdx);
    G.selected = null;
    render();
}

function onSelectAttacker(uid) {
    if (G.busy || G.current !== 'player' || G.gameOver) return;
    let card = G.player.field.find(c => c.uid === uid);
    if (!card || card.sleeping || card.frozen || card.attacked) return;

    G.selected = (G.selected === uid) ? null : uid;
    render();
}

async function onAttackTarget(targetUid) {
    if (G.busy || !G.selected || G.gameOver) return;

    let targets = getLegalTargets('player');
    if (!targets.some(t => t.uid === targetUid)) return;

    let atkUid = G.selected;
    G.selected = null;
    G.busy = true;
    render();

    await doAttack(atkUid, targetUid);

    G.busy = false;
    render();
}

async function onOppHero() {
    if (G.busy || !G.selected || G.gameOver) return;
    if (!canAttackHero('player')) return;

    let atkUid = G.selected;
    G.selected = null;
    G.busy = true;
    render();

    await doAttackHero(atkUid);

    G.busy = false;
    render();
}

async function onEndTurn() {
    if (G.busy || G.current !== 'player' || G.gameOver) return;
    G.selected = null;
    G.busy = true;
    render();
    await aiTurn();
}

// ===========================
// ИНИЦИАЛИЗАЦИЯ
// ===========================
function init() {
    G = newState();
    G.player.deck = makeDeck();
    G.opponent.deck = makeDeck();

    // Начальная рука: 4 карты
    for (let i = 0; i < 4; i++) {
        draw('player');
        draw('opponent');
    }

    document.getElementById('log').innerHTML = '';
    document.getElementById('btn-new').hidden = true;
    document.getElementById('confetti-box').innerHTML = '';

    log('🏟 Матч Легенд начинается!');
    log('☕ Васин vs 🎲 Кларк');

    startTurn('player');
    render();
    showBanner('Ваш ход ☕');
}

// Старт
init();
