import { generateMonster, sortMonsters, refreshCombatNumbers } from './generator.js';

let data = null;
let currentMonster = null;
let savedMonsters = [];

// Load JSON data
async function loadData() {
  const response = await fetch('./public/data/monster_generator_data.json');
  data = await response.json();
  console.log('Data loaded');
  loadFromBrowser();
}

// Generate monster
function handleGenerate() {
  if (!data) return alert('Data not loaded yet');

  const cr = document.getElementById('crInput').value;
  const rarity = document.getElementById('rarityInput').value;
  const country = document.getElementById('countryInput').value;

  currentMonster = generateMonster(data, { cr, rarity, country });

  savedMonsters.push(currentMonster); // ← optional
  savedMonsters = sortMonsters(savedMonsters);

  renderMonster(currentMonster);
  renderLibrary();
  renderFavorites();
  saveToBrowser();
}

//clear local storage
function clearBrowserStorage() {
  const confirmed = confirm('This will permanently delete all saved monsters from this browser. Continue?');

  if (!confirmed) return;

  localStorage.removeItem('savedMonsters');
  localStorage.removeItem('currentMonster');

  savedMonsters = [];
  currentMonster = null;

  document.getElementById('output').innerHTML = '<p>No monster selected.</p>';

  renderLibrary();
  renderFavorites();

  alert('Saved data cleared.');
}

// Save monster
function handleSave() {
  if (!currentMonster) return;

  const newName = currentMonster.name.trim().toLowerCase();

  const exists = savedMonsters.some(
    (monster) => monster.name.trim().toLowerCase() === newName
  );

  if (exists) {
    const overwrite = confirm(
      'A monster with this name already exists. Do you want to overwrite it?'
    );

    if (!overwrite) return;

    savedMonsters = savedMonsters.map((monster) =>
      monster.name.trim().toLowerCase() === newName
        ? currentMonster
        : monster
    );
  } else {
    savedMonsters.push(currentMonster);
  }

  savedMonsters = sortMonsters(savedMonsters);

  renderLibrary();
  renderFavorites();
  saveToBrowser();
}

function formatStat(value) {
  const mod = Math.floor((value - 10) / 2);
  return `${value} (${mod >= 0 ? '+' : ''}${mod})`;
}

function renderSection(title, html) {
  if (!html || html.trim() === '') return '';
  return `
    <h3>${title}</h3>
    <div class="section-content">${html}</div>
  `;
}

function renderMonster(monster) {
  const output = document.getElementById('output');

  output.innerHTML = `
    <article class="monster-card">
      <header class="monster-title">
        <h2>${monster.name}</h2>
        <p><em>${monster.size} ${monster.creatureType}${monster.subtype ? ` (${monster.subtype})` : ''}, ${monster.alignment}</em></p>
		<p><strong>${monster.favorite ? '⭐ Favorite' : ''}</strong></p>
      </header>

      <div class="red-rule"></div>

      <p><strong>Armor Class</strong> ${monster.defenses.armorClass} (${monster.defenses.armorType})</p>
      <p><strong>Hit Points</strong> ${monster.defenses.hitPoints.average} (${monster.defenses.hitPoints.formula})</p>
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
      <p><strong>Languages</strong> ${monster.languages.length ? monster.languages.join(', ') : '—'}</p>
      <p><strong>Challenge</strong> ${monster.cr}</p>

      <div class="red-rule"></div>

      ${renderSection('Traits', monster.ddb.traits)}
      ${renderSection('Actions', monster.ddb.actions)}
      ${renderSection('Bonus Actions', monster.ddb.bonusActions)}
      ${renderSection('Reactions', monster.ddb.reactions)}
      ${renderSection('Legendary Actions', monster.ddb.legendaryActions)}
    </article>
  `;
}

function exportMonsters() {
  const exportData = {
    exportedAt: new Date().toISOString(),
    monsters: savedMonsters
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = 'saved_monsters.json';
  a.click();

  URL.revokeObjectURL(url);
}

function importMonsters(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);

      savedMonsters = sortMonsters(imported.monsters || []);
      renderLibrary();
      renderFavorites();
      saveToBrowser();

      alert('Monsters imported successfully.');
    } catch (err) {
      alert('Invalid JSON file.');
    }
  };

  reader.readAsText(file);
}

function handleFavorite() {
  if (!currentMonster) return;

  currentMonster.favorite = !currentMonster.favorite;

  savedMonsters = savedMonsters.map((monster) =>
    monster.id === currentMonster.id ? currentMonster : monster
  );

  savedMonsters = sortMonsters(savedMonsters);

  renderMonster(currentMonster);
  renderLibrary();
  renderFavorites();
  saveToBrowser();
}

function renderLibrary() {
  const library = document.getElementById('monsterLibrary');
  const searchValue = document.getElementById('librarySearch')?.value.toLowerCase() || '';
  const favoriteFilter = document.getElementById('libraryFavoriteFilter')?.value || 'all';

  let filteredMonsters = savedMonsters.filter((monster) => {
    const searchableText = [
      monster.name,
      monster.country,
      monster.rarity,
      monster.cr,
      monster.creatureType,
      monster.subtype
    ]
      .join(' ')
      .toLowerCase();

    const matchesSearch = searchableText.includes(searchValue);
    const matchesFavorite =
      favoriteFilter === 'all' || monster.favorite === true;

    return matchesSearch && matchesFavorite;
  });

  filteredMonsters = sortMonsters(filteredMonsters);

  if (filteredMonsters.length === 0) {
    library.innerHTML = '<p>No matching monsters found.</p>';
    return;
  }

  const grouped = {};

  filteredMonsters.forEach((monster) => {
    if (!grouped[monster.country]) grouped[monster.country] = {};
    if (!grouped[monster.country][monster.rarity]) grouped[monster.country][monster.rarity] = {};
    if (!grouped[monster.country][monster.rarity][monster.cr]) {
      grouped[monster.country][monster.rarity][monster.cr] = [];
    }

    grouped[monster.country][monster.rarity][monster.cr].push(monster);
  });

  library.innerHTML = Object.entries(grouped)
    .map(([country, rarityGroups]) => `
      <details class="library-group" open>
        <summary>${country}</summary>

        ${Object.entries(rarityGroups)
          .map(([rarity, crGroups]) => `
            <details class="library-subgroup" open>
              <summary>${rarity}</summary>

              ${Object.entries(crGroups)
                .map(([cr, monsters]) => `
                  <details class="library-crgroup" open>
                    <summary>CR ${cr}</summary>

                    ${monsters
                      .map((monster) => `
                        <button class="library-card" data-id="${monster.id}">
                          <strong>${monster.favorite ? '⭐ ' : ''}${monster.name}</strong>
                          <span>${monster.rarity} | CR ${monster.cr}</span>
                        </button>
                      `)
                      .join('')}
                  </details>
                `)
                .join('')}
            </details>
          `)
          .join('')}
      </details>
    `)
    .join('');

  document.querySelectorAll('.library-card').forEach((card) => {
    card.addEventListener('click', () => {
      const monsterId = card.dataset.id;
      const selected = savedMonsters.find((monster) => monster.id === monsterId);

      if (!selected) return;

      currentMonster = selected;
      renderMonster(currentMonster);
    });
  });
}

function openEditPanel() {
  if (!currentMonster) return alert('Generate or select a monster first.');

  document.getElementById('editName').value = currentMonster.name || '';
  document.getElementById('editAC').value = currentMonster.defenses.armorClass || '';
  document.getElementById('editHP').value = currentMonster.defenses.hitPoints.average || '';
  document.getElementById('editNotes').value = currentMonster.notes || '';
}

function renderFavorites() {
  const favoritesList = document.getElementById('favoritesList');
  const favorites = savedMonsters.filter((monster) => monster.favorite);

  if (favorites.length === 0) {
    favoritesList.innerHTML = '<p>No favorites yet.</p>';
    return;
  }

  favoritesList.innerHTML = favorites
    .map((monster) => `
      <button class="favorite-card" data-id="${monster.id}">
        <strong>⭐ ${monster.name}</strong>
        <span>CR ${monster.cr} | ${monster.rarity}</span>
      </button>
    `)
    .join('');

  document.querySelectorAll('.favorite-card').forEach((card) => {
    card.addEventListener('click', () => {
      const monsterId = card.dataset.id;
      const selected = savedMonsters.find((monster) => monster.id === monsterId);

      if (!selected) return;

      currentMonster = selected;
      renderMonster(currentMonster);
    });
  });
}

function replaceMonsterNameEverywhere(monster, oldName, newName) {
  const text = JSON.stringify(monster);
  const updatedText = text.replaceAll(oldName, newName);
  return JSON.parse(updatedText);
}

function applyEdits() {
  if (!currentMonster) return;

  const oldName = currentMonster.name;
  const newName = document.getElementById('editName').value;

    currentMonster = {
      ...currentMonster,
      name: newName,
      notes: document.getElementById('editNotes').value,
      defenses: {
        ...currentMonster.defenses,
        armorClass: Number(document.getElementById('editAC').value),
        hitPoints: {
          ...currentMonster.defenses.hitPoints,
          average: Number(document.getElementById('editHP').value)
        }
      },
      updatedAt: new Date().toISOString()
    };

    currentMonster = replaceMonsterNameEverywhere(currentMonster, oldName, newName);

  savedMonsters = savedMonsters.map((monster) =>
    monster.id === currentMonster.id ? currentMonster : monster
  );

  savedMonsters = sortMonsters(savedMonsters);

  renderMonster(currentMonster);
  renderLibrary();
  renderFavorites();
  saveToBrowser();
}

function syncSavedMonster() {
  if (!currentMonster) return;

  currentMonster.updatedAt = new Date().toISOString();

  savedMonsters = savedMonsters.map((monster) =>
    monster.id === currentMonster.id ? currentMonster : monster
  );

  savedMonsters = sortMonsters(savedMonsters);
  renderMonster(currentMonster);
  renderLibrary();
  renderFavorites();
  saveToBrowser();
}

function saveToBrowser() {
  localStorage.setItem('savedMonsters', JSON.stringify(savedMonsters));
  localStorage.setItem('currentMonster', JSON.stringify(currentMonster));
}

function loadFromBrowser() {
  const storedSaved = localStorage.getItem('savedMonsters');
  const storedCurrent = localStorage.getItem('currentMonster');

  savedMonsters = storedSaved ? JSON.parse(storedSaved) : [];
  savedMonsters = sortMonsters(savedMonsters);

  currentMonster = storedCurrent ? JSON.parse(storedCurrent) : null;

  renderLibrary();
  renderFavorites();

  if (currentMonster) {
    renderMonster(currentMonster);
  }
}

function rerollSection(section) {
  if (!currentMonster || !data) return alert('Generate or select a monster first.');

if (section === 'all') {
  const oldName = currentMonster.name;
  const oldFavorite = currentMonster.favorite;
  const oldId = currentMonster.id;

  currentMonster = generateMonster(data, {
    cr: currentMonster.cr,
    rarity: currentMonster.rarity,
    country: currentMonster.country
  });

  // Preserve existing identity data
  currentMonster.name = oldName;
  currentMonster.id = oldId;
  currentMonster.favorite = oldFavorite;

  // Keep DDB name synced if it exists
  if (currentMonster.ddb?.name) {
    currentMonster.ddb.name = oldName;
  }

  syncSavedMonster();
  return;
}

  const fresh = generateMonster(data, {
    cr: currentMonster.cr,
    rarity: currentMonster.rarity,
    country: currentMonster.country
  });

  switch (section) {
    case 'stats':
      currentMonster.stats = fresh.stats;
      currentMonster = refreshCombatNumbers(currentMonster);
      break;

    case 'movement':
      currentMonster.movement = fresh.movement;
      currentMonster.ddb.movement = fresh.ddb.movement;
      break;

    case 'defenses':
      currentMonster.defenses.resistances = fresh.defenses.resistances;
      currentMonster.defenses.vulnerabilities = fresh.defenses.vulnerabilities;
      currentMonster.defenses.immunities = fresh.defenses.immunities;
      currentMonster.ddb.resistances = fresh.ddb.resistances;
      currentMonster.ddb.vulnerabilities = fresh.ddb.vulnerabilities;
      currentMonster.ddb.immunities = fresh.ddb.immunities;
      break;

    case 'skills':
      currentMonster.skills = fresh.skills;
      currentMonster.ddb.skills = fresh.ddb.skills;
      break;

    case 'senses':
      currentMonster.senses = fresh.senses;
      currentMonster.ddb.senses = fresh.ddb.senses;
      break;

    case 'saves':
      currentMonster.savingThrows = fresh.savingThrows;
      currentMonster.ddb.savingThrows = fresh.ddb.savingThrows;
      break;

    case 'abilities':
      currentMonster.randomAbilities = fresh.randomAbilities;
      currentMonster.traits = fresh.traits;
      currentMonster.ddb.traits = fresh.ddb.traits;
      break;

    case 'moves':
      currentMonster.actions = fresh.actions;
      currentMonster.bonusActions = fresh.bonusActions;
      currentMonster.reactions = fresh.reactions;
      currentMonster.legendaryActions = fresh.legendaryActions;
      currentMonster.ddb.actions = fresh.ddb.actions;
      currentMonster.ddb.bonusActions = fresh.ddb.bonusActions;
      currentMonster.ddb.reactions = fresh.ddb.reactions;
      currentMonster.ddb.legendaryActions = fresh.ddb.legendaryActions;
      break;

    case 'spells':
      currentMonster.actions = fresh.actions;
      currentMonster.bonusActions = fresh.bonusActions;
      currentMonster.reactions = fresh.reactions;
      currentMonster.spellcasting = fresh.spellcasting;
      currentMonster.traits = fresh.traits;
      currentMonster.legendaryActions = fresh.legendaryActions;
      currentMonster.ddb.traits = fresh.ddb.traits;
      currentMonster.ddb.actions = fresh.ddb.actions;
      currentMonster.ddb.bonusActions = fresh.ddb.bonusActions;
      currentMonster.ddb.reactions = fresh.ddb.reactions;
      currentMonster.ddb.legendaryActions = fresh.ddb.legendaryActions;
      break;

    case 'legendary':
      currentMonster.legendaryActions = fresh.legendaryActions;
      currentMonster.ddb.legendaryActions = fresh.ddb.legendaryActions;
      break;

    case 'identity':
      currentMonster.size = fresh.size;
      currentMonster.creatureType = fresh.creatureType;
      currentMonster.subtype = fresh.subtype;
      currentMonster.ddb.basicInfo.size = fresh.size;
      currentMonster.ddb.basicInfo.creatureType = fresh.creatureType;
      currentMonster.ddb.basicInfo.subtype = fresh.subtype;
      break;
  }

  syncSavedMonster();
}

function closeLeftPanels(exceptId = null) {
  ['rerollPanel', 'editSidePanel'].forEach((id) => {
    if (id !== exceptId) {
      document.getElementById(id)?.classList.add('collapsed');
    }
  });
}

function updateLeftPanelState() {
  const anyOpen = ['rerollPanel', 'editSidePanel'].some((id) => {
    const panel = document.getElementById(id);
    return panel && !panel.classList.contains('collapsed');
  });

  document.body.classList.toggle('left-panel-open', anyOpen);
}

function toggleLeftPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const isCollapsed = panel.classList.contains('collapsed');

  closeLeftPanels(panelId);

  if (isCollapsed) {
    panel.classList.remove('collapsed');
  } else {
    panel.classList.add('collapsed');
  }

  updateLeftPanelState();
}

function buildDDBText(monster) {
  return `
${monster.name}
${monster.size} ${monster.creatureType}${monster.subtype ? ` (${monster.subtype})` : ''}, ${monster.alignment}

Armor Class ${monster.defenses.armorClass} (${monster.defenses.armorType})
Hit Points ${monster.defenses.hitPoints.average} (${monster.defenses.hitPoints.formula})
Speed ${monster.ddb.movement}

STR ${monster.stats.str} (${abilityMod(monster.stats.str) >= 0 ? '+' : ''}${abilityMod(monster.stats.str)})
DEX ${monster.stats.dex} (${abilityMod(monster.stats.dex) >= 0 ? '+' : ''}${abilityMod(monster.stats.dex)})
CON ${monster.stats.con} (${abilityMod(monster.stats.con) >= 0 ? '+' : ''}${abilityMod(monster.stats.con)})
INT ${monster.stats.int} (${abilityMod(monster.stats.int) >= 0 ? '+' : ''}${abilityMod(monster.stats.int)})
WIS ${monster.stats.wis} (${abilityMod(monster.stats.wis) >= 0 ? '+' : ''}${abilityMod(monster.stats.wis)})
CHA ${monster.stats.cha} (${abilityMod(monster.stats.cha) >= 0 ? '+' : ''}${abilityMod(monster.stats.cha)})

${monster.ddb.savingThrows ? `Saving Throws ${monster.ddb.savingThrows}` : ''}
${monster.ddb.skills ? `Skills ${monster.ddb.skills}` : ''}
${monster.ddb.resistances ? `Damage Resistances ${monster.ddb.resistances}` : ''}
${monster.ddb.vulnerabilities ? `Damage Vulnerabilities ${monster.ddb.vulnerabilities}` : ''}
${monster.ddb.immunities ? `Damage Immunities ${monster.ddb.immunities}` : ''}
Senses ${monster.ddb.senses || ''}, passive Perception ${monster.derived.passivePerception}
Languages ${monster.languages.length ? monster.languages.join(', ') : '—'}
Challenge ${monster.cr}

${monster.ddb.traits || ''}

Actions
${monster.ddb.actions || ''}

Bonus Actions
${monster.ddb.bonusActions || ''}

Reactions
${monster.ddb.reactions || ''}

${monster.ddb.legendaryActions ? `Legendary Actions\n${monster.ddb.legendaryActions}` : ''}
  `.trim();
}

function copyToDDB() {
  if (!currentMonster) return alert('Generate or select a monster first.');

  const text = buildDDBText(currentMonster);

  navigator.clipboard.writeText(text)
    .then(() => alert('Copied for D&D Beyond!'))
    .catch(() => alert('Copy failed.'));
}

function removeCurrentMonster() {
  if (!currentMonster) {
    return alert('No monster selected.');
  }

  const confirmed = confirm(
    `Remove ${currentMonster.name} from your monster library?`
  );

  if (!confirmed) return;

  savedMonsters = savedMonsters.filter(
    (monster) => monster.id !== currentMonster.id
  );

  currentMonster = null;

  document.getElementById('output').innerHTML = '<p>No monster selected.</p>';

  renderLibrary();
  renderFavorites();
  saveToBrowser();
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

// Hook buttons
document.getElementById('generateBtn').addEventListener('click', handleGenerate);
document.getElementById('saveBtn').addEventListener('click', handleSave);
document.getElementById('exportBtn').addEventListener('click', exportMonsters);
document.getElementById('importFile').addEventListener('change', importMonsters);
document.getElementById('favoriteBtn').addEventListener('click', handleFavorite);
//document.getElementById('editBtn').addEventListener('click', openEditPanel);
document.getElementById('applyEditBtn').addEventListener('click', applyEdits)
document.getElementById('toggleFavoritesPanel').addEventListener('click', () => {
document.getElementById('favoritesPanel').classList.toggle('collapsed');});
document.getElementById('librarySearch').addEventListener('input', renderLibrary);
document.getElementById('libraryFavoriteFilter').addEventListener('change', renderLibrary);
document.getElementById('clearStorageBtn').addEventListener('click', clearBrowserStorage);
document.getElementById("removeMonsterBtn").addEventListener("click", removeCurrentMonster);

//document.getElementById('copyDDBBtn').addEventListener('click', copyToDDB);
const btn = document.getElementById('copyDDBBtn');

btn.addEventListener('click', () => {
  if (!currentMonster) return alert('Generate or select a monster first.');

  const text = buildDDBText(currentMonster);

  navigator.clipboard.writeText(text)
    .then(() => {
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy for D&D Beyond', 1500);
    })
    .catch(() => alert('Copy failed.'));
});

document.getElementById('toggleRerollPanel').addEventListener('click', () => {
  toggleLeftPanel('rerollPanel');
});

document.getElementById('toggleEditPanel').addEventListener('click', () => {
  if (!currentMonster) return alert('Generate or select a monster first.');

  openEditPanel();
  toggleLeftPanel('editSidePanel');
});

document.querySelectorAll('[data-reroll]').forEach((button) => {
  button.addEventListener('click', () => {
    rerollSection(button.dataset.reroll);
  });
});

// Load data on start
loadData();