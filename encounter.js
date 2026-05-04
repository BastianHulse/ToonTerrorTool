import { generateMonster, sortMonsters, refreshCombatNumbers } from './generator.js';
import { abilityMod } from './utils.js';

let data = null;
let savedMonsters = [];
let combatants = [];
let selectedCombatantId = null;
let encounterMutationLog = JSON.parse(localStorage.getItem('encounterMutationLog')) || [];
let pendingMiniMutations = [];
let activeTerrainMutation = null;

const SKILL_ABILITY_MAP = {Athletics: 'str', Acrobatics: 'dex', 'Sleight of Hand': 'dex', Stealth: 'dex', Arcana: 'int', History: 'int', Investigation: 'int', Nature: 'int', Religion: 'int', 'Animal Handling': 'wis', Insight: 'wis', Medicine: 'wis', Perception: 'wis', Survival: 'wis', Deception: 'cha', Intimidation: 'cha', Performance: 'cha', Persuasion: 'cha'};

async function loadData() {
  const response = await fetch('./public/data/monster_generator_data.json');
  data = await response.json();

  savedMonsters = JSON.parse(localStorage.getItem('savedMonsters')) || [];
  savedMonsters = sortMonsters(savedMonsters);

  loadEncounter();
  populateEncounterFilters();
  populateMonsterSelect();
  renderEncounter();
}

function saveEncounter() {
  localStorage.setItem(
    'encounterState',
    JSON.stringify({
      combatants,
      activeTerrainMutation
    })
  );
}

function loadEncounter() {
  const data = JSON.parse(localStorage.getItem('encounterState'));

  if (!data) return;

  combatants = data.combatants || [];
  activeTerrainMutation = data.activeTerrainMutation || null;
}

function signedBonus(value) {
  return `${value >= 0 ? '+' : ''}${value}`;
}

function populateEncounterFilters() {
  const countryFilter = document.getElementById('encounterCountryFilter');
  if (!countryFilter) return;

  const countries = [...new Set(savedMonsters.map((monster) => monster.country).filter(Boolean))].sort();

  countryFilter.innerHTML = `
    <option value="all">All Countries</option>
    ${countries.map((country) => `<option value="${country}">${country}</option>`).join('')}
  `;
}

function populateMonsterSelect() {
  const select = document.getElementById('monsterSelect');
  const countryValue = document.getElementById('encounterCountryFilter')?.value || 'all';
  const favoriteValue = document.getElementById('encounterFavoriteFilter')?.value || 'all';

  let filteredMonsters = [...savedMonsters];

  if (countryValue !== 'all') {
    filteredMonsters = filteredMonsters.filter((monster) => monster.country === countryValue);
  }

  if (favoriteValue === 'favorites') {
    filteredMonsters = filteredMonsters.filter((monster) => monster.favorite);
  }

  if (filteredMonsters.length === 0) {
    select.innerHTML = '<option value="">No matching monsters found</option>';
    return;
  }

  select.innerHTML = filteredMonsters
    .map((monster) => `
      <option value="${monster.id}">
        ${monster.favorite ? '⭐ ' : ''}${monster.name} — CR ${monster.cr} — ${monster.rarity}
      </option>
    `)
    .join('');
}

function rollInitiative(monster) {
  const rawRoll = Math.floor(Math.random() * 20) + 1;
  const dexBonus = abilityMod(monster.stats.dex);

  return {
    rawRoll,
    dexBonus,
    total: rawRoll + dexBonus
  };
}

function getEncounterMonsterName(baseName) {
  const sameBaseCount = combatants.filter(
    (combatant) =>
      combatant.type === 'monster' &&
      combatant.baseName === baseName
  ).length;

  if (sameBaseCount === 0) return baseName;

  const letter = String.fromCharCode(97 + sameBaseCount); // a, b, c...
  return `${baseName} (${letter})`;
}

function addMonsterToEncounter() {
  const monsterId = document.getElementById('monsterSelect').value;
  const monster = savedMonsters.find((m) => m.id === monsterId);

  if (!monster) return alert('Select a saved monster first.');

  const initiativeRoll = rollInitiative(monster);
  const initiative = initiativeRoll.total;

  const maxHp = monster.defenses.hitPoints.average;

  const encounterName = getEncounterMonsterName(monster.name);

  combatants.push({
    id: crypto.randomUUID(),
    type: 'monster',
    sourceMonsterId: monster.id,
    baseName: monster.name,
    name: encounterName,
    initiative,
    initiativeRawRoll: initiativeRoll.rawRoll,
    initiativeBonus: initiativeRoll.dexBonus,
    miniMutationFails: 0,
    mutationCount: 0,
    starterTrait:
    initiativeRoll.rawRoll === 20
        ? 'Quick Starter'
        : initiativeRoll.rawRoll === 1
            ? 'Slow Starter'
            : '',
    currentHp: maxHp,
    maxHp,
    monsterData: {
        ...structuredClone(monster),
        name: encounterName,
    }
  });

  sortEncounter();
  saveEncounter();
  renderEncounter();
}

function addPlayerToEncounter() {
  const name = document.getElementById('playerNameInput').value.trim();
  const initiative = Number(document.getElementById('playerInitiativeInput').value);

  if (!name) return alert('Enter a player name.');

  combatants.push({
    id: crypto.randomUUID(),
    type: 'player',
    name,
    initiative,
    currentHp: 1,
    maxHp: 1
  });

  sortEncounter();
  saveEncounter();
  renderEncounter();
}

function sortEncounter() {
  combatants.sort((a, b) => b.initiative - a.initiative);
}

function changeHp(id, mode) {
  const amount = Number(document.querySelector(`[data-hp-input="${id}"]`).value || 0);

  combatants = combatants.map((combatant) => {
    if (combatant.id !== id) return combatant;

    const nextHp =
      mode === 'damage'
        ? combatant.currentHp - amount
        : combatant.currentHp + amount;

    return {
      ...combatant,
      currentHp: Math.max(0, Math.min(combatant.maxHp, nextHp))
    };
  });

  saveEncounter();
  renderEncounter();
}

function removeCombatant(id) {
  combatants = combatants.filter((combatant) => combatant.id !== id);

  if (selectedCombatantId === id) selectedCombatantId = null;

  saveEncounter();
  renderEncounter();
}

function openRightPanel(panelId) {
  const panels = ['statblockPanel', 'logPanel', 'mutationPanel', 'randomMutationPanel'];

  panels.forEach((id) => {
    const panel = document.getElementById(id);
    if (!panel) return;

    if (id === panelId) {
      panel.classList.remove('collapsed');
    } else {
      panel.classList.add('collapsed');
    }
  });

  document.body.classList.add('tools-open');
}

function selectCombatant(id) {
  selectedCombatantId = id;

  renderEncounter();
  renderSelectedMonsterPanel();
  renderMutationSelectedMonster();
  renderRandomMutationSelectedMonster();

  const selected = getSelectedCombatant();

  if (selected?.type === 'monster') {
  const panels = ['statblockPanel', 'logPanel', 'mutationPanel', 'randomMutationPanel'];

  const anyPanelOpen = panels.some((panelId) => {
    const panel = document.getElementById(panelId);
    return panel && !panel.classList.contains('collapsed');
  });

  if (!anyPanelOpen) {
    openRightPanel('statblockPanel');
  }
}
}

function updateInitiative(id, newInitiative) {
  combatants = combatants.map((combatant) =>
    combatant.id === id
      ? { ...combatant, initiative: newInitiative }
      : combatant
  );

  sortEncounter();
  saveEncounter();
  renderEncounter();
  renderSelectedMonsterPanel();
}

function slugifyImageName(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function getMonsterImage() {
  return './images/placeholder.png';
}

function getMutationClasses(combatant) {
  if (combatant.type !== 'monster') return '';

  const count = combatant.mutationCount || 0;

  if (count >= 15) return 'mutation-stage-5';
  if (count >= 10) return 'mutation-stage-4';
  if (count >= 6) return 'mutation-stage-3';
  if (count >= 3) return 'mutation-stage-2';
  if (count >= 1) return 'mutation-stage-1';

  return '';
}

function renderEncounter() {
  const list = document.getElementById('encounterList');

  const terrainIcons = {
  "Heavy Rain": "🌧️",
  "Quicksand": "🟤",
  "Hailstorm": "❄️",
  "Anvil Rain": "⚒️",
  "Acid Rain": "🧪",
  "Aquarium": "🐠",
  "Lava Lakes": "🌋",
  "Poisonous Sludge Swamp": "☣️",
  "Random Spiked Pits": "🕳️",
  "Closing Spiked Wall": "🧱"
};

const icon = terrainIcons[activeTerrainMutation] || "🌍";
  
  const terrainDisplay = activeTerrainMutation
  ? `<div class="terrain-banner">${icon} ${activeTerrainMutation}</div>`
  : '';

  if (combatants.length === 0) {
    list.innerHTML = `
      ${terrainDisplay}
      <p>No combatants added yet.</p>
    `;
    return;
  }

    const combatantHtml = combatants
    .map((combatant) => `
        <div class="
        encounter-row 
        ${combatant.id === selectedCombatantId ? 'selected-combatant' : ''}
        ${combatant.currentHp <= 0 ? 'dead-combatant' : ''}
        ">
        
        <div class="initiative-column">
            <div class="initiative-label">INITIATIVE</div>
                <input
                class="initiative-score initiative-input"
                type="number"
                value="${combatant.initiative}"
                data-init-input="${combatant.id}"
                />
        </div>
        <div class="combatant-middle">
        <div class="combatant-image ${getMutationClasses(combatant)}">
            <img 
              src="${
                combatant.type === 'monster'
                  ? getMonsterImage(combatant.monsterData)
                  : './images/placeholder.png'
              }"
              alt="${combatant.name}"
              onerror="this.src='./images/placeholder.png'"
            />
        </div>

        <div class="combatant-info">
        <button class="combatant-name-btn" data-select="${combatant.id}">
            ${combatant.name}
        </button>

        <div class="combatant-detail-grid">
        ${
            combatant.type === 'monster'
            ? `
                <div class="detail-row">
                <span><strong>CR: </strong> ${combatant.monsterData.cr}</span>
                <span><strong>AC: </strong> ${combatant.monsterData.defenses.armorClass}</span>
                <span><strong>HP</strong> ${combatant.maxHp} (${combatant.monsterData.defenses.hitPoints.formula})</span>
                </div>

                <div class="detail-row">
                <span><strong>Rarity: </strong> ${combatant.monsterData.rarity}</span>
                <span><strong>Init. Bonus: </strong> ${combatant.initiativeBonus >= 0 ? '+' : ''}${combatant.initiativeBonus}</span>
                
                </div>

                ${
                combatant.starterTrait
                    ? `<div class="detail-row starter-row">${combatant.starterTrait}</div>`
                    : ''
                }
            `
            : `
                <div class="detail-row">
                <span><strong>Player Character</strong></span>
                </div>
            `
        }
        </div>
        </div>
        </div>

        <div class="hp-section">
            <div class="hp-display">
            ${combatant.currentHp} / ${combatant.maxHp}
            </div>

            <input 
            data-hp-input="${combatant.id}" 
            type="number" 
            placeholder="Amount"
            class="hp-input"
            />

            <div class="hp-buttons">
            <button data-damage="${combatant.id}">Damage</button>
            <button data-heal="${combatant.id}">Heal</button>
            <button class="remove-combatant-btn" data-remove="${combatant.id}">
            ✕
            </button>
            </div>
        </div>
        </div>
    `)
    .join('');
    list.innerHTML = `
    ${terrainDisplay}
    ${combatantHtml}
  `;

  document.querySelectorAll('[data-select]').forEach((button) => {
    button.addEventListener('click', () => selectCombatant(button.dataset.select));
  });

  document.querySelectorAll('[data-damage]').forEach((button) => {
    button.addEventListener('click', () => changeHp(button.dataset.damage, 'damage'));
  });

  document.querySelectorAll('[data-heal]').forEach((button) => {
    button.addEventListener('click', () => changeHp(button.dataset.heal, 'heal'));
  });

  document.querySelectorAll('[data-remove]').forEach((button) => {
    button.addEventListener('click', () => removeCombatant(button.dataset.remove));
  });

  document.querySelectorAll('[data-init-input]').forEach((input) => {
  input.addEventListener('change', () => {
    updateInitiative(input.dataset.initInput, Number(input.value));
  });
});

renderSelectedMonsterPanel();
renderMutationSelectedMonster();
renderRandomMutationSelectedMonster();
}

function getMutationChance(objectName) {
  const row = data.rules.rarity.MiniMutationChances?.find(
    (entry) => entry.Objects === objectName
  );

  return row ? Number(row.Chance) : 0;
}

function rollPercent(chance) {
  return Math.random() * 100 <= chance;
}

const RARITY_ORDER = [
  'Normal', 'Rare', 'Unique', 'Miniboss', 'Boss'
];

function increaseRarity(rarity) {
  const currentIndex = RARITY_ORDER.indexOf(rarity);

  if (currentIndex === -1) return rarity;

  const newIndex = Math.min(
    currentIndex + 1,
    RARITY_ORDER.length - 1
  );

  return RARITY_ORDER[newIndex];
}

function shiftCrByRarity(currentCr, rarity) {
  const crList = data.rules.cr.CRLookup.map((row) => String(row['CR Lookup']));

  const currentIndex = crList.findIndex((cr) => cr === String(currentCr));
  if (currentIndex === -1) return currentCr;

  const randomizerRow = data.rules.rarity.CRRandomizer.find(
    (row) => row.Rarity === rarity
  );

  if (!randomizerRow) return currentCr;

  const minShift = Number(randomizerRow.Min);
  const maxShift = Number(randomizerRow.Max);

  const shiftAmount = randomFromRange(minShift, maxShift);

  const newIndex = Math.max(
    0,
    Math.min(crList.length - 1, currentIndex + shiftAmount)
  );

  return crList[newIndex];
}

function updateMonsterNameForRarity(monster, oldRarity, newRarity) {
  if (!monster.name) return;

  if (monster.name.includes(oldRarity)) {
    monster.name = monster.name.replace(oldRarity, newRarity);
  } else {
    monster.name = `${newRarity} ${monster.name}`;
  }
}

function mutateMonster(monster, category) {
  const fresh = generateMonster(data, {
    cr: monster.cr,
    rarity: monster.rarity,
    country: monster.country
  });

  const realName = monster.name;
  const generatedName = fresh.name;

  switch (category) {
    case 'Rarity': {
        const oldRarity = monster.rarity;
        const newRarity = increaseRarity(oldRarity);

        monster.rarity = newRarity;
        updateMonsterNameForRarity(monster, oldRarity, newRarity);

        monster.ddb.basicInfo ||= {};
        monster.ddb.basicInfo.rarity = monster.rarity;

        return {monster, logMessage: `Rarity: ${oldRarity} → ${newRarity}`};
    }

    case 'CR': {
      const oldCr = monster.cr;
      const newCr = shiftCrByRarity(monster.cr, monster.rarity);

      monster.cr = newCr;
      monster.ddb.basicInfo ||= {};
      monster.ddb.basicInfo.cr = newCr;

      return {
        monster,
        logMessage: `CR: ${oldCr} → ${newCr}`
      };
    }

    case 'Stats': {
      const oldStats = { ...monster.stats };

      monster.stats = fresh.stats;
      monster = refreshCombatNumbers(monster);
      rebuildDdb(monster);

      return {
        monster,
        logMessage:
          `Stats rerolled: ` +
          `STR ${oldStats.str} → ${monster.stats.str}, ` +
          `DEX ${oldStats.dex} → ${monster.stats.dex}, ` +
          `CON ${oldStats.con} → ${monster.stats.con}, ` +
          `INT ${oldStats.int} → ${monster.stats.int}, ` +
          `WIS ${oldStats.wis} → ${monster.stats.wis}, ` +
          `CHA ${oldStats.cha} → ${monster.stats.cha}`
      };
    }

    case 'Moves': {
      const oldMoveNames = [
        ...(monster.actions || []),
        ...(monster.bonusActions || []),
        ...(monster.reactions || [])
      ].map((move) => move.name).join(', ') || 'None';

      monster.actions = replaceGeneratedName(fresh.actions, generatedName, realName);
      monster.bonusActions = replaceGeneratedName(fresh.bonusActions, generatedName, realName);
      monster.reactions = replaceGeneratedName(fresh.reactions, generatedName, realName);

      const newMoveNames = [
        ...(monster.actions || []),
        ...(monster.bonusActions || []),
        ...(monster.reactions || [])
      ].map((move) => move.name).join(', ') || 'None';

      rebuildDdb(monster);

      return {
        monster,
        logMessage: `Moves: ${oldMoveNames} → ${newMoveNames}`
      };
    }

    case 'Spells': {
      const oldSpellNames = [
        ...(monster.actions || []),
        ...(monster.bonusActions || []),
        ...(monster.reactions || [])
      ].filter((entry) => entry.sourceType === 'spell')
        .map((spell) => spell.name)
        .join(', ') || 'None';

      monster.spellcasting = fresh.spellcasting;
      monster.traits = replaceGeneratedName(fresh.traits, generatedName, realName);
      monster.actions = replaceGeneratedName(fresh.actions, generatedName, realName);
      monster.bonusActions = replaceGeneratedName(fresh.bonusActions, generatedName, realName);
      monster.reactions = replaceGeneratedName(fresh.reactions, generatedName, realName);

      const newSpellNames = [
        ...(monster.actions || []),
        ...(monster.bonusActions || []),
        ...(monster.reactions || [])
      ].filter((entry) => entry.sourceType === 'spell')
        .map((spell) => spell.name)
        .join(', ') || 'None';

      rebuildDdb(monster);

      return {
        monster,
        logMessage: `Spells: ${oldSpellNames} → ${newSpellNames}`
      };
    }

    case 'Resistances': {
      const oldValue = formatList(monster.defenses.resistances || []);
      monster.defenses.resistances = fresh.defenses.resistances;
      rebuildDdb(monster);

      return {
        monster,
        logMessage: `Resistances: ${oldValue || 'None'} → ${monster.ddb.resistances || 'None'}`
      };
    }

    case 'Vulnerabilities': {
      const oldValue = formatList(monster.defenses.vulnerabilities || []);
      monster.defenses.vulnerabilities = fresh.defenses.vulnerabilities;
      rebuildDdb(monster);

      return {
        monster,
        logMessage: `Vulnerabilities: ${oldValue || 'None'} → ${monster.ddb.vulnerabilities || 'None'}`
      };
    }

    case 'Immunities': {
      const oldValue = formatList(monster.defenses.immunities || []);
      monster.defenses.immunities = fresh.defenses.immunities;
      rebuildDdb(monster);

      return {
        monster,
        logMessage: `Immunities: ${oldValue || 'None'} → ${monster.ddb.immunities || 'None'}`
      };
    }

    case 'Senses': {
      const oldValue = monster.ddb.senses || 'None';

      monster.senses = fresh.senses;
      rebuildDdb(monster);

      return {
        monster,
        logMessage: `Senses: ${oldValue} → ${monster.ddb.senses || 'None'}`
      };
    }

    case 'Health': {
      const oldMaxHp = monster.defenses.hitPoints.average;
      const newMaxHp = fresh.defenses.hitPoints.average;
      const hpDifference = newMaxHp - oldMaxHp;

      monster.defenses.hitPoints = fresh.defenses.hitPoints;
      monster.pendingHpDifference = hpDifference;

      rebuildDdb(monster);

      return {
        monster,
        logMessage: `Health: ${oldMaxHp} → ${newMaxHp}`
      };
    }

    case 'Skills': {
      const oldValue = monster.ddb.skills || 'None';

      monster.skills = fresh.skills;
      rebuildDdb(monster);

      return {
        monster,
        logMessage: `Skills: ${oldValue} → ${monster.ddb.skills || 'None'}`
      };
    }

    case 'Speed': {
      const oldValue = monster.ddb.movement || 'None';

      monster.movement = fresh.movement;
      rebuildDdb(monster);

      return {
        monster,
        logMessage: `Speed: ${oldValue} → ${monster.ddb.movement || 'None'}`
      };
    }

    case 'Saving Throws': {
      const oldValue = monster.ddb.savingThrows || 'None';

      monster.savingThrows = fresh.savingThrows;
      rebuildDdb(monster);

      return {
        monster,
        logMessage: `Saving Throws: ${oldValue} → ${monster.ddb.savingThrows || 'None'}`
      };
    }

    case 'AC': {
      const oldAC = monster.defenses.armorClass;
      const newAC = fresh.defenses.armorClass;

      monster.defenses.armorClass = newAC;
      rebuildDdb(monster);

      return {
        monster,
        logMessage: `AC: ${oldAC} → ${newAC}`
      };
    }

    case 'Multiattack': {
      const oldMultiattack = monster.derived.multiattack;
      const newMultiattack = fresh.derived.multiattack;

      monster.derived.multiattack = newMultiattack;

      monster.actions = (monster.actions || []).filter(
        (action) => action.id !== 'multiattack'
      );

      if (newMultiattack > 1) {
        monster.actions.unshift({
          id: 'multiattack',
          name: 'Multiattack',
          description: `${monster.name} makes ${newMultiattack} attacks when it takes the Attack action.`,
          sourceType: 'move'
        });
      }

      rebuildDdb(monster);;

      rebuildDdb(monster);

      return {
        monster,
        logMessage: `Multiattack: ${oldMultiattack} → ${newMultiattack}`
      };
    }

    case 'Abilities': {
      const oldAbilityNames = (monster.randomAbilities || [])
        .map((ability) => ability.name)
        .join(', ') || 'None';

      monster.randomAbilities = replaceGeneratedName(fresh.randomAbilities, generatedName, realName);
      monster.traits = replaceGeneratedName(fresh.traits, generatedName, realName);

      const newAbilityNames = (monster.randomAbilities || [])
        .map((ability) => ability.name)
        .join(', ') || 'None';

      rebuildDdb(monster);

      return {
        monster,
        logMessage: `Abilities: ${oldAbilityNames} → ${newAbilityNames}`
      };
    }

    case 'Damage Die': {
  const allMoves = [
    ...(monster.actions || []),
    ...(monster.bonusActions || []),
    ...(monster.reactions || [])
  ].filter((move) => move.sourceType === 'move' && move.id !== 'multiattack');

  const targetMove = pickRandomItem(allMoves);

  if (!targetMove) {
    return {
      monster,
      logMessage: 'Damage Die: no valid move found'
    };
  }

  const oldDamage = targetMove.damage?.primaryDice || 'None';

  const freshMoves = [
    ...(fresh.actions || []),
    ...(fresh.bonusActions || []),
    ...(fresh.reactions || [])
  ].filter((move) => move.sourceType === 'move' && move.damage);

  const freshMove = pickRandomItem(freshMoves);
  const newDamage = freshMove?.damage?.primaryDice || oldDamage;

  targetMove.damage ||= {};
  targetMove.damage.primaryDice = newDamage;

  rebuildDdb(monster);

  return {
    monster,
    logMessage: `Damage Die: ${targetMove.name} ${oldDamage} → ${newDamage}`
  };
}

    default:
      return {
        monster,
        logMessage: `${category}: no mutation handler`
      };
  }
}

function nextRoundMutations() {
  const log = [];
  pendingMiniMutations = [];

  if (Math.random() < 0.2) {
    const terrainOptions = data.rules.lookups.TerrainMutationLookup;

    const picked =
      terrainOptions[Math.floor(Math.random() * terrainOptions.length)];

    activeTerrainMutation = picked["Terrain Mutations"];

    addMutationLog(`🌍 Terrain Mutation: ${activeTerrainMutation}`);
  }

  combatants.forEach((combatant) => {
    if (combatant.type !== 'monster') return;

    const monster = combatant.monsterData;
    const rarity = monster.rarity;
    const fails = combatant.miniMutationFails || 0;

    const chanceRow = data.rules.rarity.CRMutationChance.find(
      (row) => row.Rarity === rarity
    );

    if (!chanceRow) {
      log.push(`${combatant.name}: No mutation chance found for ${rarity}.`);
      return;
    }

    const startChance = Number(chanceRow.Starting || 0);
    const addEachFail = Number(chanceRow.AddEachFail || 0);
    const totalChance = Math.min(100, startChance + fails * addEachFail);

    if (!rollPercent(totalChance)) {
      combatant.miniMutationFails = fails + 1;
      log.push(`${combatant.name}: No Mutation`);
      return;
    }

    combatant.miniMutationFails = 0;

    const rolledMutations = [];

    data.rules.rarity.MiniMutationChances.forEach((row) => {
      if (rollPercent(Number(row.Chance))) {
        rolledMutations.push(row.Objects);
      }
    });

    if (rolledMutations.length === 0) {
      log.push(`${combatant.name}: Mutation Hit – Nothing Mutated`);
      return;
    }

    pendingMiniMutations.push({
      combatantId: combatant.id,
      mutations: rolledMutations
    });

    log.push(`${combatant.name}: ${rolledMutations.join(', ')}`);
  });

  saveEncounter();
  renderEncounter();

  document.getElementById('mutationLog').textContent =
    log.length > 0 ? log.join(' | ') : 'No monsters in encounter.';
}

function applyRolledMiniMutations() {
  if (pendingMiniMutations.length === 0) {
    return alert('No rolled mini mutations to apply.');
  }

  pendingMiniMutations.forEach((pending) => {
    const combatant = combatants.find((item) => item.id === pending.combatantId);

    if (!combatant || combatant.type !== 'monster') return;

    let monster = combatant.monsterData;

    const mutationDetails = [];

      pending.mutations.forEach((category) => {
        const result = mutateMonster(monster, category);

        monster = result.monster;
        mutationDetails.push(result.logMessage);
      });

    combatant.mutationCount += pending.mutations.length;
    combatant.monsterData = monster;
    combatant.name = monster.name;
    const hpDifference = monster.pendingHpDifference || 0;

    combatant.maxHp = monster.defenses.hitPoints.average;

    if (hpDifference > 0) {
    combatant.currentHp += hpDifference;
    } else {
    combatant.currentHp = Math.min(combatant.currentHp, combatant.maxHp);
    }

    delete monster.pendingHpDifference;

    addMutationLog(`${combatant.name}: ${mutationDetails.join(' | ')}`);
  });

  pendingMiniMutations = [];

  saveEncounter();
  renderEncounter();
  renderSelectedMonsterPanel();
  renderMutationSelectedMonster();
  renderRandomMutationSelectedMonster();

  document.getElementById('mutationLog').textContent =
    'Rolled mini mutations applied.';
}

function getSelectedCombatant() {
  return combatants.find((combatant) => combatant.id === selectedCombatantId);
}

function saveMutationLog() {
  localStorage.setItem('encounterMutationLog', JSON.stringify(encounterMutationLog));
}

function addMutationLog(message) {
  encounterMutationLog.unshift({
    time: new Date().toLocaleTimeString(),
    message
  });

  saveMutationLog();
  renderMutationLog();
}

function renderMutationLog() {
  const log = document.getElementById('encounterMutationLog');

  if (!log) return;

  if (encounterMutationLog.length === 0) {
    log.innerHTML = '<p>No mutations yet.</p>';
    return;
  }

  log.innerHTML = encounterMutationLog
    .map((entry) => `
      <div class="log-entry">
        <strong>${entry.time}</strong><br>
        ${entry.message}
      </div>
    `)
    .join('');
}

function clearMutationLog() {
  const confirmed = confirm('Clear the mutation log?');
  if (!confirmed) return;

  encounterMutationLog = [];
  localStorage.removeItem('encounterMutationLog');
  renderMutationLog();
}

function formatStat(value) {
  const mod = Math.floor((value - 10) / 2);
  return `${value} (${mod >= 0 ? '+' : ' '}${mod})`;
}

function renderSelectedMonsterPanel() {
  const container = document.getElementById('selectedMonsterStatblock');
  const selected = getSelectedCombatant();

  if (!container) return;

  if (!selected || selected.type !== 'monster') {
    container.innerHTML = '<p>Select a monster from the encounter.</p>';
    return;
  }

  const monster = selected.monsterData;

  container.innerHTML = `
    <article class="monster-card">
      <header class="monster-title">
        <h2>${selected.name}</h2>
        <p><em>${monster.size} ${monster.creatureType}${monster.subtype ? ` (${monster.subtype})` : ''}, ${monster.alignment}</em></p>
      </header>

      <div class="red-rule"></div>

      <p><strong>Armor Class</strong> ${monster.defenses.armorClass} (${monster.defenses.armorType})</p>
      <p><strong>Hit Points</strong> ${selected.currentHp} / ${selected.maxHp} (${monster.defenses.hitPoints.formula})</p>
      <p><strong>Speed</strong> ${monster.ddb.movement || '—'}</p>

      <div class="red-rule"></div>

      <div class="stat-grid">
        <div><strong>STR</strong><br>${formatStat(monster.stats.str)}</div>
        <div><strong>DEX</strong><br>${formatStat(monster.stats.dex)}</div>
        <div><strong>CON</strong><br>${formatStat(monster.stats.con)}</div>
        <div><strong>INT</strong><br>${formatStat(monster.stats.int)}</div>
        <div><strong>WIS</strong><br>${formatStat(monster.stats.wis)}</div>
        <div><strong>CHA</strong><br>${formatStat(monster.stats.cha)}</div>
      </div>

      <div class="red-rule"></div>

      ${monster.ddb.savingThrows ? `<p><strong>Saving Throws</strong> ${monster.ddb.savingThrows}</p>` : ''}
      ${monster.ddb.skills ? `<p><strong>Skills</strong> ${monster.ddb.skills}</p>` : ''}
      ${monster.ddb.resistances ? `<p><strong>Damage Resistances</strong> ${monster.ddb.resistances}</p>` : ''}
      ${monster.ddb.vulnerabilities ? `<p><strong>Damage Vulnerabilities</strong> ${monster.ddb.vulnerabilities}</p>` : ''}
      ${monster.ddb.immunities ? `<p><strong>Damage Immunities</strong> ${monster.ddb.immunities}</p>` : ''}
      ${monster.ddb.senses ? `<p><strong>Senses</strong> ${monster.ddb.senses}, passive Perception ${monster.derived.passivePerception}</p>` : `<p><strong>Senses</strong> passive Perception ${monster.derived.passivePerception}</p>`}
      <p><strong>Languages</strong> ${monster.languages?.length ? monster.languages.join(', ') : '—'}</p>
      <p><strong>Challenge</strong> ${monster.cr}</p>

      <div class="red-rule"></div>

      ${renderPanelSection('Traits', monster.ddb.traits)}
      ${renderPanelSection('Actions', monster.ddb.actions)}
      ${renderPanelSection('Bonus Actions', monster.ddb.bonusActions)}
      ${renderPanelSection('Reactions', monster.ddb.reactions)}
      ${renderPanelSection('Legendary Actions', monster.ddb.legendaryActions)}
    </article>
  `;
}

function renderPanelSection(title, html) {
  if (!html || html.trim() === '') return '';
  return `
    <h3>${title}</h3>
    <div class="section-content">${html}</div>
  `;
}

function closeRightPanels(exceptId = null) {
  ['statblockPanel', 'logPanel', 'mutationPanel', 'randomMutationPanel'].forEach((id) => {
    if (id !== exceptId) {
      document.getElementById(id)?.classList.add('collapsed');
    }
  });
}

function toggleRightPanel(panelId) {
  const panels = ['statblockPanel', 'logPanel', 'mutationPanel', 'randomMutationPanel'];
  const targetPanel = document.getElementById(panelId);
  if (!targetPanel) return;

  const targetIsOpen = !targetPanel.classList.contains('collapsed');

  // If clicking the already-open panel's button, close everything
  if (targetIsOpen) {
    targetPanel.classList.add('collapsed');
    document.body.classList.remove('tools-open');
    return;
  }

  // Otherwise close other panels and open this one
  panels.forEach((id) => {
    const panel = document.getElementById(id);
    if (!panel) return;

    if (id === panelId) {
      panel.classList.remove('collapsed');
    } else {
      panel.classList.add('collapsed');
    }
  });

  document.body.classList.add('tools-open');
}

/*function applyDetailedMutation() {
  const selected = getSelectedCombatant();

  if (!selected || selected.type !== 'monster') {
    return alert('Select a monster first.');
  }

  const monster = selected.monsterData;
  const category = document.getElementById('targetMutationCategory').value;
  const value = document.getElementById('targetMutationValue').value.trim();
  const action = document.getElementById('targetMutationAction').value;

  if (!value) return alert('Enter a mutation value.');

    monster.defenses.resistances ||= [];
    monster.defenses.immunities ||= [];
    monster.defenses.vulnerabilities ||= [];

  function addToList(listName, ddbName, label) {
    if (action === 'add' && !monster.defenses[listName].includes(value)) {
      monster.defenses[listName].push(value);
    }

    if (action === 'remove') {
      monster.defenses[listName] = monster.defenses[listName].filter(
        (item) => item !== value
      );
    }

    monster.ddb[ddbName] = monster.defenses[listName].join(', ');
    addMutationLog(`${selected.name}: ${action} ${label} ${value}.`);
  }

  if (category === 'Resistances') {
    addToList('resistances', 'resistances', 'resistance');
  }

  if (category === 'Immunities') {
    addToList('immunities', 'immunities', 'immunity');
  }

  if (category === 'Vulnerabilities') {
    addToList('vulnerabilities', 'vulnerabilities', 'vulnerability');
  }

  if (category === 'Speed') {
  const speedRow = data.rules.cr.SpeedRange.find(
    (row) => String(row.CR) === String(monster.cr)
  );

  let randomDistance = 30;

  if (speedRow) {
    const min = Number(speedRow.Min || speedRow.min || 30);
    const max = Number(speedRow.Max || speedRow.max || 30);

    randomDistance = Math.floor(Math.random() * (max - min + 1)) + min;
    randomDistance = Math.round(randomDistance / 5) * 5;
  }

  const newSpeed = {
    type: value,
    value: randomDistance
  };

  monster.movement ||= [];

  const existingIndex = monster.movement.findIndex(
    (speed) => speed.type.toLowerCase() === value.toLowerCase()
  );

  if (action === 'add') {
    if (existingIndex === -1) {
      monster.movement.push(newSpeed);
    }
  }

  if (action === 'replace') {
    if (monster.movement.length > 0) {
      const randomIndex = Math.floor(Math.random() * monster.movement.length);
      monster.movement[randomIndex] = newSpeed;
    } else {
      monster.movement.push(newSpeed);
    }
  }

  if (action === 'remove') {
    monster.movement = monster.movement.filter(
      (speed) => speed.type.toLowerCase() !== value.toLowerCase()
    );
  }

  monster.ddb.movement = monster.movement
    .map((speed) => `${speed.type} ${speed.value} ft.`)
    .join(', ');

  addMutationLog(`${selected.name}: ${action} speed ${value} ${randomDistance} ft.`);
}

  saveEncounter();
  renderEncounter();
  renderSelectedMonsterPanel();
  renderMutationSelectedMonster();
}*/

function renderMutationSelectedMonster() {
  const box = document.getElementById('mutationSelectedMonster');
  const selected = getSelectedCombatant();

  if (!box) return;

  if (!selected || selected.type !== 'monster') {
    box.textContent = 'No monster selected';
    box.classList.add('empty');
    return;
  }

  box.textContent = `Editing: ${selected.name}`;
  box.classList.remove('empty');
}

function getNumberValue() {
  return Number(document.getElementById('targetMutationNumber')?.value);
}

function pickRandomItem(list = []) {
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function findCrRow(rows, cr) {
  return rows.find((row) => String(row.CR ?? row.cr) === String(cr));
}

function randomFromRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatList(list = []) {
  return list.join(', ');
}

function formatMovement(movement = []) {
  return movement.map((speed) => `${speed.type} ${speed.value} ft.`).join(', ');
}

function formatSkills(skills = []) {
  return skills
    .map((skill) => {
      if (typeof skill === 'string') return skill;
      return `${skill.name} ${signedBonus(skill.bonus)}`;
    })
    .join(', ');
}

function formatSavingThrows(savingThrows = []) {
  return savingThrows
    .map((save) => {
      if (typeof save === 'string') return save;
      return `${save.stat.toUpperCase()} ${signedBonus(save.bonus)}`;
    })
    .join(', ');
}

function formatSenses(senses = []) {
  return senses
    .map((sense) => {
      if (typeof sense === 'string') return sense;

      const type =
        sense.type ||
        sense.name ||
        sense.sense ||
        sense.Sense ||
        sense.Senses;

      const distance =
        sense.value ||
        sense.distance ||
        sense.Distance ||
        sense.range ||
        sense.Range;

      if (!type) return '';

      if (distance) {
        return `${type} ${distance} ft.`;
      }

      return type;
    })
    .filter(Boolean)
    .join(', ');
}

function formatTraitText(list = []) {
  return list
    .map((item) => `<strong><em>${item.name}.</em></strong> ${item.description}`)
    .join('\n\n');
}

function formatActionsForEncounter(list = []) {
  return list
    .map((item) => {
      const rangeSuffix = item.rangeText ? ` (${item.rangeText})` : '';
      let attackSuffix = '';

      if (item.sourceType === 'move' && item.damage) {
        attackSuffix = ` To Hit: ${signedBonus(item.attackBonus)}. Damage: ${item.damage.primaryDice} ${signedBonus(item.damageBonus)}`;

        const damageType = item.damageType || item.dndDamageType || '';
        if (damageType) attackSuffix += ` ${damageType} Damage`;

        if (item.damage.secondaryDice) {
          attackSuffix += ` + ${item.damage.secondaryDice}`;
          if (item.damage.secondaryDamageType) {
            attackSuffix += ` ${item.damage.secondaryDamageType} Damage`;
          }
        }

        attackSuffix += '.';
      }

      return `<strong><em>${item.name}.</em></strong> ${item.description}${rangeSuffix}${attackSuffix}`;
    })
    .join('\n\n');
}

function rebuildDdb(monster) {
  monster.ddb ||= {};
  monster.ddb.basicInfo ||= {};

  monster.ddb.basicInfo.cr = monster.cr;
  monster.ddb.basicInfo.rarity = monster.rarity;
  monster.ddb.stats = monster.stats;
  monster.ddb.armorClass = `${monster.defenses.armorClass} (${monster.defenses.armorType || 'Natural Armor'})`;
  monster.ddb.hitPoints = `${monster.defenses.hitPoints.average} (${monster.defenses.hitPoints.formula})`;
  monster.ddb.movement = formatMovement(monster.movement || []);
  monster.ddb.skills = formatSkills(monster.skills || []);
  monster.ddb.savingThrows = formatSavingThrows(monster.savingThrows || []);
  monster.ddb.senses = formatSenses(monster.senses || []);
  monster.ddb.resistances = formatList(monster.defenses.resistances || []);
  monster.ddb.vulnerabilities = formatList(monster.defenses.vulnerabilities || []);
  monster.ddb.immunities = formatList(monster.defenses.immunities || []);
  monster.ddb.traits = formatTraitText(monster.traits || []);
  monster.ddb.actions = formatActionsForEncounter(monster.actions || []);
  monster.ddb.bonusActions = formatActionsForEncounter(monster.bonusActions || []);
  monster.ddb.reactions = formatActionsForEncounter(monster.reactions || []);
}

function makeDamageObject(count, die, damageType) {
  return {
    primaryDice: `${count}d${die}`,
    secondaryDice: '',
    secondaryDamageType: '',
    damageType
  };
}

function getMoveAttackAbility(move, stats) {
  const style = String(move.attackStyle || '').toLowerCase();

  const physical = [
    { key: 'str', label: 'STR', value: stats.str },
    { key: 'dex', label: 'DEX', value: stats.dex },
    { key: 'con', label: 'CON', value: stats.con }
  ];

  const magical = [
    { key: 'int', label: 'INT', value: stats.int },
    { key: 'wis', label: 'WIS', value: stats.wis },
    { key: 'cha', label: 'CHA', value: stats.cha }
  ];

  const pool = style === 'magical' || style === 'status' ? magical : physical;

  return pool
    .map((stat) => ({ ...stat, mod: abilityMod(stat.value) }))
    .sort((a, b) => b.mod - a.mod)[0];
}

function addRandomMoveByDamageType(monster, damageType) {
  const pool = (data.content.moves || []).filter((move) =>
    move.enabled !== false &&
    String(move.dndDamageType || move.damageType || '').toLowerCase() === damageType.toLowerCase()
  );

  const move = pickRandomItem(pool);
  if (!move) return null;

  const damageRow = findCrRow(data.rules.cr.DamageDiceInfo, monster.cr);
  const count = damageRow ? randomFromRange(Number(damageRow['# Min']), Number(damageRow['# Max'])) : 1;
  const dieRaw = damageRow ? pickRandomItem([damageRow['Type Min'], damageRow['Type Mid'], damageRow['Type Max']]) : 'd6';
  const die = String(dieRaw).replace(/[()d]/g, '').trim() || '6';

  const attackAbility = getMoveAttackAbility(move, monster.stats);

  const newMove = {
    ...structuredClone(move),
    sourceType: 'move',
    damageType,
    damage: makeDamageObject(count, die, damageType),
    attackAbility: attackAbility.label,
    attackBonus: monster.derived.proficiencyBonus + attackAbility.mod,
    damageBonus: attackAbility.mod
  };

  const actionType = String(newMove.actionType || 'Action').toLowerCase();

  if (actionType.includes('bonus')) {
    monster.bonusActions ||= [];
    monster.bonusActions.push(newMove);
  } else if (actionType.includes('reaction')) {
    monster.reactions ||= [];
    monster.reactions.push(newMove);
  } else {
    monster.actions ||= [];
    monster.actions.push(newMove);
  }

  return newMove;
}

function addRandomSpellByLevel(monster, level) {
  const pool = (data.content.spells || []).filter((spell) =>
    spell.enabled !== false && Number(spell.level) === Number(level)
  );

  const spell = pickRandomItem(pool);
  if (!spell) return null;

  const newSpell = {
    ...structuredClone(spell),
    sourceType: 'spell'
  };

  const actionType = String(newSpell.actionType || newSpell.castingTime || 'Action').toLowerCase();

  if (actionType.includes('bonus')) {
    monster.bonusActions ||= [];
    monster.bonusActions.push(newSpell);
  } else if (actionType.includes('reaction')) {
    monster.reactions ||= [];
    monster.reactions.push(newSpell);
  } else {
    monster.actions ||= [];
    monster.actions.push(newSpell);
  }

  return newSpell;
}

function addAbility(monster, value, action) {
  const pool = data.content.randomAbilities || [];
  const ability =
    action === 'replace'
      ? pickRandomItem(pool.filter((item) => item.enabled !== false))
      : pool.find((item) => item.name === value);

  if (!ability) return null;

  monster.randomAbilities ||= [];
  monster.traits ||= [];

  if (action === 'remove') {
    monster.randomAbilities = monster.randomAbilities.filter((item) => item.name !== value);
    monster.traits = monster.traits.filter((item) => item.name !== value);
    return { name: value };
  }

  if (!monster.randomAbilities.some((item) => item.name === ability.name)) {
    monster.randomAbilities.push(structuredClone(ability));
    monster.traits.push(structuredClone(ability));
  }

  return ability;
}

function replaceGeneratedName(value, generatedName, realName) {
  if (!generatedName || !realName) return value;

  if (typeof value === 'string') {
    return value.replaceAll(generatedName, realName);
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceGeneratedName(item, generatedName, realName));
  }

  if (value && typeof value === 'object') {
    const copy = { ...value };

    Object.keys(copy).forEach((key) => {
      copy[key] = replaceGeneratedName(copy[key], generatedName, realName);
    });

    return copy;
  }

  return value;
}

function addOrRemoveSimpleList(monster, listPath, value, action) {
  const list = listPath.reduce((obj, key) => obj[key], monster);

  if (action === 'add' && !list.includes(value)) {
    list.push(value);
  }

  if (action === 'remove') {
    const index = list.indexOf(value);
    if (index !== -1) list.splice(index, 1);
  }

  if (action === 'replace') {
    if (list.length > 0) {
      const randomIndex = Math.floor(Math.random() * list.length);
      list[randomIndex] = value;
    } else {
      list.push(value);
    }
  }
}

function applyDetailedMutation() {
  const selected = getSelectedCombatant();

  if (!selected || selected.type !== 'monster') {
    return alert('Select a monster first.');
  }

  let monster = selected.monsterData;
  const category = document.getElementById('targetMutationCategory').value;
  const value = document.getElementById('targetMutationValue').value;
  const action = document.getElementById('targetMutationAction').value;
  const numberValue = getNumberValue();

  monster.ddb ||= {};
  monster.defenses ||= {};
  monster.defenses.resistances ||= [];
  monster.defenses.immunities ||= [];
  monster.defenses.vulnerabilities ||= [];
  monster.skills ||= [];
  monster.savingThrows ||= [];
  monster.senses ||= [];
  monster.movement ||= [];
  monster.actions ||= [];
  monster.bonusActions ||= [];
  monster.reactions ||= [];
  monster.spellcasting ||= {};
  monster.derived ||= {};

  switch (category) {
    case 'Rarity': {
        const oldRarity = monster.rarity;
        const newRarity = value;

        monster.rarity = newRarity;
        updateMonsterNameForRarity(monster, oldRarity, newRarity);

        monster.ddb.basicInfo ||= {};
        monster.ddb.basicInfo.rarity = newRarity;

        selected.name = monster.name;

        addMutationLog(`${selected.name}: rarity set to ${newRarity}.`);
        break;
    }

    case 'CR':
      monster.cr = value;
      monster.ddb.basicInfo ||= {};
      monster.ddb.basicInfo.cr = value;
      addMutationLog(`${selected.name}: CR set to ${value}.`);
      break;

      case 'Health': {
        const amount = numberValue;

        if (Number.isNaN(amount)) {
          return alert('Enter a valid health number.');
        }

        const oldMaxHp = monster.defenses.hitPoints.average;
        const oldCurrentHp = selected.currentHp ?? oldMaxHp;

        if (action === 'set') {
          monster.defenses.hitPoints.average = amount;
          selected.maxHp = amount;
          selected.currentHp = Math.min(oldCurrentHp, amount);

          addMutationLog(`${selected.name}: max HP set to ${amount}.`);
        }

        if (action === 'replace') {
          monster.defenses.hitPoints.average = amount;
          selected.maxHp = amount;
          selected.currentHp = Math.min(oldCurrentHp, amount);

          addMutationLog(`${selected.name}: max HP replaced with ${amount}.`);
        }

        break;
      }

    case 'Stats': {
        const oldStats = { ...monster.stats };
        const statKey = value.toLowerCase();
        const numberInput = document.getElementById('targetMutationNumber');
        const rawNumberValue = numberInput?.value.trim();

        if (!monster.stats || monster.stats[statKey] === undefined) {
            return alert(`Could not find stat: ${value}`);
        }

        if (action === 'replace') {
            const fresh = generateMonster(data, {
            cr: monster.cr,
            rarity: monster.rarity,
            country: monster.country
            });

            monster.stats[statKey] = fresh.stats[statKey];
            addMutationLog(`${selected.name}: rerolled ${value}.`);
        } else {
            if (rawNumberValue === '') {
            return alert('Enter a stat score.');
            }

            const newScore = Number(rawNumberValue);

            if (Number.isNaN(newScore)) {
            return alert('Enter a valid stat score.');
            }

            monster.stats[statKey] = Math.max(1, newScore);
            addMutationLog(`${selected.name}: ${value} set to ${newScore}.`);
        }

        monster = refreshCombatNumbers(monster);

            monster.derived.initiativeBonus = abilityMod(monster.stats.dex);
            monster.derived.passivePerception = 10 + abilityMod(monster.stats.wis);

            if (statKey === 'dex') {
              const oldInitiativeBonus = abilityMod(oldStats.dex);
              const newInitiativeBonus = abilityMod(monster.stats.dex);
              const initiativeDifference = newInitiativeBonus - oldInitiativeBonus;

              selected.initiativeBonus = newInitiativeBonus;
              selected.initiative += initiativeDifference;
            }

            if (statKey === 'con') {
              const hpDiceCount = Number(
                String(monster.defenses.hitPoints.formula).split('d8')[0]
              ) || 1;

              const oldConHpBonus = Math.max(0, abilityMod(oldStats.con) * hpDiceCount);
              const newConHpBonus = Math.max(0, abilityMod(monster.stats.con) * hpDiceCount);

              const hpDifference = newConHpBonus - oldConHpBonus;

              monster.defenses.hitPoints.average += hpDifference;
              selected.maxHp += hpDifference;

              if (hpDifference > 0) {
                selected.currentHp += hpDifference;
              } else {
                selected.currentHp = Math.min(selected.currentHp, selected.maxHp);
              }

              monster.defenses.hitPoints.formula = `${hpDiceCount}d8 + ${newConHpBonus}`;
            }

            monster.skills = monster.skills.map((skill) => {
      if (typeof skill === 'string') {
        const skillStat = SKILL_ABILITY_MAP[skill];

        return {
          name: skill,
          stat: skillStat,
          bonus: abilityMod(monster.stats[skillStat]) + monster.derived.proficiencyBonus
        };
      }

      return {
        ...skill,
        bonus: abilityMod(monster.stats[skill.stat]) + monster.derived.proficiencyBonus
      };
    });

    monster.savingThrows = monster.savingThrows.map((save) => {
      if (typeof save === 'string') {
        const statKey = save.toLowerCase();

        return {
          stat: statKey,
          bonus: abilityMod(monster.stats[statKey]) + monster.derived.proficiencyBonus
        };
      }

      return {
        ...save,
        bonus: abilityMod(monster.stats[save.stat]) + monster.derived.proficiencyBonus
      };
    });

      selected.monsterData = monster;
      break;
    }

    case 'Resistances':
      addOrRemoveSimpleList(monster, ['defenses', 'resistances'], value, action);
      addMutationLog(`${selected.name}: ${action} resistance ${value}.`);
      break;

    case 'Immunities':
      addOrRemoveSimpleList(monster, ['defenses', 'immunities'], value, action);
      addMutationLog(`${selected.name}: ${action} immunity ${value}.`);
      break;

    case 'Vulnerabilities':
      addOrRemoveSimpleList(monster, ['defenses', 'vulnerabilities'], value, action);
      addMutationLog(`${selected.name}: ${action} vulnerability ${value}.`);
      break;

    case 'Skills': {
      const skillName = value;
      const statKey = SKILL_ABILITY_MAP[skillName];

      if (!statKey) return alert(`No stat mapping found for ${skillName}.`);

      const skillObject = {
        name: skillName,
        stat: statKey,
        bonus: abilityMod(monster.stats[statKey]) + monster.derived.proficiencyBonus
      };

      if (action === 'add' && !monster.skills.some((skill) => skill.name === skillName)) {
        monster.skills.push(skillObject);
      }

      if (action === 'remove') {
        monster.skills = monster.skills.filter((skill) => skill.name !== skillName);
      }

      if (action === 'replace') {
        if (monster.skills.length > 0) {
          const randomIndex = Math.floor(Math.random() * monster.skills.length);
          monster.skills[randomIndex] = skillObject;
        } else {
          monster.skills.push(skillObject);
        }
      }

      addMutationLog(`${selected.name}: ${action} skill ${skillName}.`);
      break;
    }

    case 'Saving Throws': {
      const statKey = value.toLowerCase();

      const saveObject = {
        stat: statKey,
        bonus: abilityMod(monster.stats[statKey]) + monster.derived.proficiencyBonus
      };

      if (action === 'add' && !monster.savingThrows.some((save) => save.stat === statKey)) {
        monster.savingThrows.push(saveObject);
      }

      if (action === 'remove') {
        monster.savingThrows = monster.savingThrows.filter((save) => save.stat !== statKey);
      }

      if (action === 'replace') {
        if (monster.savingThrows.length > 0) {
          const randomIndex = Math.floor(Math.random() * monster.savingThrows.length);
          monster.savingThrows[randomIndex] = saveObject;
        } else {
          monster.savingThrows.push(saveObject);
        }
      }

      addMutationLog(`${selected.name}: ${action} saving throw ${value}.`);
      break;
    }

    case 'Senses': {
      const row = data.rules.rarity.SenseDistance.find((entry) => entry.Rarity === monster.rarity);
      const distance = row
        ? Math.round(randomFromRange(Number(row.Min), Number(row.Max)) / 5) * 5
        : 30;

      if (action === 'remove') {
        monster.senses = monster.senses.filter(
          (sense) => sense.type.toLowerCase() !== value.toLowerCase()
        );
      } else {
        const newSense = {type: value, value: distance, name: value, distance};

        if (action === 'replace' && monster.senses.length > 0) {
          monster.senses[Math.floor(Math.random() * monster.senses.length)] = newSense;
        } else if (!monster.senses.some((sense) => sense.type.toLowerCase() === value.toLowerCase())) {
          monster.senses.push(newSense);
        }
      }

      addMutationLog(`${selected.name}: ${action} sense ${value}.`);
      break;
    }

    case 'Speed': {
      const row = findCrRow(data.rules.cr.SpeedRange, monster.cr);
      const distance = row
        ? Math.round(randomFromRange(Number(row.Min), Number(row.Max)) / 5) * 5
        : 30;

      if (action === 'remove') {
        monster.movement = monster.movement.filter(
          (speed) => speed.type.toLowerCase() !== value.toLowerCase()
        );
      } else {
        const newSpeed = { type: value, value: distance };

        if (action === 'replace' && monster.movement.length > 0) {
          monster.movement[Math.floor(Math.random() * monster.movement.length)] = newSpeed;
        } else if (!monster.movement.some((speed) => speed.type.toLowerCase() === value.toLowerCase())) {
          monster.movement.push(newSpeed);
        }
      }

      addMutationLog(`${selected.name}: ${action} speed ${value}.`);
      break;
    }

    case 'AC':
      if (Number.isNaN(numberValue)) return alert('Enter an AC number.');
      monster.defenses.armorClass = numberValue;
      addMutationLog(`${selected.name}: AC set to ${numberValue}.`);
      break;

    case 'Multiattack': {
      if (Number.isNaN(numberValue)) {
        return alert('Enter a multiattack number.');
      }

      const amount = Math.max(1, numberValue);
      monster.derived.multiattack = amount;

      // Remove old Multiattack action if it exists
      monster.actions = (monster.actions || []).filter(
        (action) => action.id !== 'multiattack'
      );

      // Add updated Multiattack action at the top
      if (amount > 1) {
        monster.actions.unshift({
          id: 'multiattack',
          name: 'Multiattack',
          description: `${monster.name} makes ${amount} attacks when it takes the Attack action.`,
          sourceType: 'move'
        });
      }

      addMutationLog(`${selected.name}: multiattack set to ${amount}.`);
      break;
    }

    case 'Moves': {
      const addedMove = addRandomMoveByDamageType(monster, value);
      if (!addedMove) return alert(`No enabled moves found for ${value}.`);
      addMutationLog(`${selected.name}: added ${addedMove.name} (${value}).`);
      break;
    }

    case 'Spells': {
      const addedSpell = addRandomSpellByLevel(monster, value);
      if (!addedSpell) return alert(`No enabled level ${value} spells found.`);
      addMutationLog(`${selected.name}: added spell ${addedSpell.name}.`);
      break;
    }

    case 'Abilities': {
      const ability = addAbility(monster, value, action);
      if (!ability) return alert('No ability found.');
      addMutationLog(`${selected.name}: ${action} ability ${ability.name}.`);
      break;
    }

    case 'Spell Slot Level':
      if (Number.isNaN(numberValue)) return alert('Enter a spell slot level.');
      monster.spellcasting.slotLevel = numberValue;
      addMutationLog(`${selected.name}: spell slot level set to ${numberValue}.`);
      break;

    case 'Spell Slot #':
      if (Number.isNaN(numberValue)) return alert('Enter spell uses per day.');
      monster.spellcasting.usesPerDay = numberValue;
      addMutationLog(`${selected.name}: spell uses per day set to ${numberValue}.`);
      break;

    case 'Damage Die': {
      if (Number.isNaN(numberValue)) return alert('Enter the dice count as the number value.');

      const dieSize = value.replace('d', '');
      const allMoves = [
        ...(monster.actions || []),
        ...(monster.bonusActions || []),
        ...(monster.reactions || [])
      ].filter((move) => move.sourceType === 'move');

      const targetMove = pickRandomItem(allMoves);
      if (!targetMove) return alert('This monster has no moves to update.');

      targetMove.damage ||= {};
      targetMove.damage.primaryDice = `${numberValue}d${dieSize}`;

      addMutationLog(`${selected.name}: changed ${targetMove.name} damage die to ${numberValue}d${dieSize}.`);
      break;
    }

    default:
      return alert(`No mutation handler for ${category}.`);
  }

  selected.monsterData = monster;
  selected.name = monster.name;
  selected.maxHp = monster.defenses.hitPoints.average;
  selected.currentHp = Math.min(selected.currentHp, selected.maxHp);

  rebuildDdb(monster);

  saveEncounter();
  renderEncounter();
  renderSelectedMonsterPanel();
  renderMutationSelectedMonster();
}

function getLookupValuesForMutation(category) {
  const lookups = data?.rules?.lookups || {};

  switch (category) {
    case 'Rarity':
      return ['Normal', 'Rare', 'Unique', 'Miniboss', 'Boss'];

    case 'CR':
      return [
        '0', '1/8', '1/4', '1/2',
        '1', '2', '3', '4', '5',
        '6', '7', '8', '9', '10',
        '11', '12', '13', '14', '15',
        '16', '17', '18', '19', '20'
      ];
    case 'Damage Die':
      return ['4', '6', '8', '10', '12', '20'];
    case 'Spells':
      return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    case 'Moves':
    case 'Resistances':
    case 'Vulnerabilities':
    case 'Immunities':
      return (lookups.DamageTypesLookup || [])
        .map(normalizeLookupValue)
        .filter(Boolean);

    case 'Speed':
      return (lookups.SpeedTypesLookup || [])
        .map(normalizeLookupValue)
        .filter(Boolean);

    case 'Skills':
      return (lookups.SkillLookup || lookups.SkillsLookup || [])
        .map(normalizeLookupValue)
        .filter(Boolean);

    case 'Senses':
      return (lookups.SensesLookup || [])
        .map(normalizeLookupValue)
        .filter(Boolean);

    case 'Stats':
    case 'Saving Throws':
      return ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
    case 'Spell Slot Level':
    case 'Multiattack':
    case 'Spell Slot #':
      return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    case 'Health':
      return ['-20', '-10', '-5', '-2', '-1', '+1', '+2', '+5', '+10', '+20'];
    case 'AC':
      return ['-4', '-3', '-2', '-1', '0', '1', '2', '3', '4'];

    case 'Abilities':
      return (data?.content?.randomAbilities || [])
        .map((ability) =>
          normalizeLookupValue(
            ability.name || ability.Name || ability
          )
        )
        .filter(Boolean);

    default:
      return [];
  }
}

function normalizeLookupValue(item) {
  if (typeof item === 'string') return item;
  if (item === null || item === undefined) return '';

  return (
    item.name ||
    item.Name ||
    item.type ||
    item.Type ||
    item.value ||
    item.Value ||
    item.damageType ||
    item.DamageType ||
    item.skill ||
    item.Skill ||
    item.sense ||
    item.Sense ||
    item.speedType ||
    item.SpeedType ||
    item['Damage Types'] ||
    item['Damage Type'] ||
    item['Skills'] ||
    item['Skill'] ||
    item['Senses'] ||
    item['Sense'] ||
    item['Speed Types'] ||
    item['Speed Type'] ||
    item['SpeedTypesLookup'] ||
    item['SpeedTypeLookup'] ||
    item['DamageTypesLookup'] ||
    item['SkillLookup'] ||
    item['SensesLookup'] ||
    Object.values(item)[0] ||
    ''
  );
}

function updateMutationValueOptions() {
  const category = document.getElementById('targetMutationCategory').value;
  const valueSelect = document.getElementById('targetMutationValue');
  const numberInput = document.getElementById('targetMutationNumber');

  const numberOnlyCategories = [
    'Health',
    'AC',
    'Multiattack',
    'Spell Slot Level',
    'Spell Slot #'
  ];

  const mixedCategories = [
    'Stats',
    'Damage Die'
  ];

  const isNumberOnly = numberOnlyCategories.includes(category);
  const isMixed = mixedCategories.includes(category);

  if (numberInput) {
    numberInput.hidden = !(isNumberOnly || isMixed);
    numberInput.value = '';
  }

  if (valueSelect) {
    valueSelect.hidden = isNumberOnly;
  }

  if (isNumberOnly) {
    valueSelect.innerHTML = '';
    return;
  }

  const values = getLookupValuesForMutation(category);

  if (values.length === 0) {
    valueSelect.innerHTML = '<option value="">No options available</option>';
    return;
  }

  valueSelect.innerHTML = values
    .map((value) => `<option value="${value}">${value}</option>`)
    .join('');
}

function applyRandomMutation(category) {
  const selected = getSelectedCombatant();

  if (!selected || selected.type !== 'monster') {
    return alert('Select a monster first.');
  }

  let monster = selected.monsterData;

  const result = mutateMonster(monster, category);

  monster = result.monster;

  selected.monsterData = monster;
  selected.name = monster.name;
  const hpDifference = monster.pendingHpDifference || 0;

    selected.maxHp = monster.defenses.hitPoints.average;

    if (hpDifference > 0) {
    selected.currentHp += hpDifference;
    } else {
    selected.currentHp = Math.min(selected.currentHp, selected.maxHp);
    }

    delete monster.pendingHpDifference;

  addMutationLog(`${selected.name}: ${result.logMessage}`);

  selected.mutationCount = (selected.mutationCount || 0) + 1;

  saveEncounter();
  renderEncounter();
  renderSelectedMonsterPanel();
  renderMutationSelectedMonster();
  renderRandomMutationSelectedMonster();
}

function renderRandomMutationSelectedMonster() {
  const box = document.getElementById('randomMutationSelectedMonster');
  const selected = getSelectedCombatant();

  if (!box) return;

  if (!selected || selected.type !== 'monster') {
    box.textContent = 'No monster selected';
    box.classList.add('empty');
    return;
  }

  box.textContent = `Rerolling: ${selected.name}`;
  box.classList.remove('empty');
}

function updateMutationActionOptions() {
  const category = document.getElementById('targetMutationCategory').value;
  const actionSelect = document.getElementById('targetMutationAction');

  const setOnlyCategories = [
    'Rarity',
    'CR',
    'Health',
    'Stats',
    'AC',
    'Multiattack',
    'Spell Slot Level',
    'Spell Slot #',
    'Damage Die'
  ];

  if (setOnlyCategories.includes(category)) {
    actionSelect.innerHTML = `
      <option value="set">Set</option>
      <option value="replace">Replace Random</option>
    `;
    return;
  }

  actionSelect.innerHTML = `
    <option value="add">Add</option>
    <option value="remove">Remove</option>
    <option value="replace">Replace Random</option>
  `;
}

function resetEncounter() {
  const confirmed = confirm(
    'This will remove all combatants, terrain, and mutation history. Continue?'
  );

  if (!confirmed) return;

  combatants = [];
  selectedCombatantId = null;
  pendingMiniMutations = [];
  activeTerrainMutation = null;
  encounterMutationLog = [];

  // Clear storage
  localStorage.removeItem('encounterState');
  localStorage.removeItem('encounterMutationLog');

  // Re-render everything
  renderEncounter();
  renderMutationLog();
  renderSelectedMonsterPanel();
  renderMutationSelectedMonster();
  renderRandomMutationSelectedMonster();

  document.getElementById('mutationLog').textContent =
    'Encounter reset.';
}

const menuToggle = document.getElementById('menuToggle');
const headerMenu = document.getElementById('headerMenu');

menuToggle.addEventListener('click', () => {
  headerMenu.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!menuToggle.contains(e.target) && !headerMenu.contains(e.target)) {
    headerMenu.classList.add('hidden');
  }
});

document.getElementById('addMonsterBtn').addEventListener('click', addMonsterToEncounter);
document.getElementById('addPlayerBtn').addEventListener('click', addPlayerToEncounter);
document.getElementById('nextRoundBtn').addEventListener('click', nextRoundMutations);
document.getElementById('applyDetailedMutationBtn').addEventListener('click', applyDetailedMutation);
document.getElementById('encounterCountryFilter').addEventListener('change', populateMonsterSelect);
document.getElementById('encounterFavoriteFilter').addEventListener('change', populateMonsterSelect);
document.getElementById('applyRolledMiniMutationsBtn').addEventListener('click', applyRolledMiniMutations);
document.getElementById('clearMutationLogBtn').addEventListener('click', clearMutationLog);
document.getElementById('resetEncounterBtn').addEventListener('click', resetEncounter);
document.getElementById('targetMutationCategory').addEventListener('change', () => {
  updateMutationValueOptions();
  updateMutationActionOptions();
});
document.getElementById('toggleStatblockPanel').addEventListener('click', () => {
  toggleRightPanel('statblockPanel');
});

document.getElementById('toggleLogPanel').addEventListener('click', () => {
  toggleRightPanel('logPanel');
});

document.getElementById('toggleMutationPanel').addEventListener('click', () => {
  toggleRightPanel('mutationPanel');
});
document.getElementById('toggleRandomMutationPanel').addEventListener('click', () => {
  toggleRightPanel('randomMutationPanel');
});

document.querySelectorAll('[data-random-mutation]').forEach((button) => {
  button.addEventListener('click', () => {
    applyRandomMutation(button.dataset.randomMutation);
  });
});

async function initEncounter() {
  await loadData();
  renderMutationLog();
  renderSelectedMonsterPanel();
  renderMutationSelectedMonster();
  updateMutationValueOptions();
  renderRandomMutationSelectedMonster();
  updateMutationActionOptions();
}

initEncounter();