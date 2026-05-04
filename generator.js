import {abilityMod, deepClone, pickRandom, randomInt, rollPercent, safeNumber, titleCase, uuid} from './utils.js';

const RARITY_RANK = { Normal: 0, Rare: 1, Unique: 2, Miniboss: 3, Boss: 4, Mythic: 5};
const SKILL_ABILITY_MAP = {Athletics: 'str', Acrobatics: 'dex', 'Sleight of Hand': 'dex', Stealth: 'dex', Arcana: 'int', History: 'int', Investigation: 'int', Nature: 'int', Religion: 'int', 'Animal Handling': 'wis', Insight: 'wis', Medicine: 'wis', Perception: 'wis', Survival: 'wis', Deception: 'cha', Intimidation: 'cha', Performance: 'cha', Persuasion: 'cha'};

function normalizeCrValue(cr) {
  return String(cr).trim();
}

function getCrValue(row) {
  return row?.cr ?? row?.CR;
}

function findCrRowIndex(rows, cr) {
  const target = normalizeCrValue(cr);
  return rows.findIndex((row) => normalizeCrValue(getCrValue(row)) === target);
}

function findByCr(rows, cr) {
  const index = findCrRowIndex(rows, cr);
  return rows[index >= 0 ? index : 0];
}

function findByCrOffset(rows, cr, offset) {
  const index = findCrRowIndex(rows, cr);
  const safeIndex = index >= 0 ? index : 0;
  const targetIndex = Math.max(0, Math.min(rows.length - 1, safeIndex + offset));
  return rows[targetIndex];
}

function findByRarity(rows, rarity) {
  return rows.find((row) => (row.rarity ?? row.Rarity) === rarity) ?? rows[0];
}
  
function generateFromChanceTable(table, rarity, pool, hardCap = 10) {
  const row = findByRarity(table, rarity);
  const count = Math.min(chainCount(row), hardCap);
  return pickRandom(pool || [], count, (item) => item && item.enabled !== false).map(normalizeLookupItem);
}

function getField(row, ...names) {
  for (const name of names) {
    if (row?.[name] !== undefined && row?.[name] !== null) return row[name];
  }
  return undefined;
}

function normalizeLookupItem(item) {
  if (typeof item === 'string') return item;

  return (
    item.name ||
    item.type ||
    item.damageType ||
    item.skill ||
    item.sense ||
    item['Damage Types'] ||
    item['Skills'] ||
    item['Senses'] ||
    item['Speed Types'] ||
    item['Classifications'] ||
    item['SizeLookup'] ||
    item['SpeciesLookup'] ||
    item['Countries'] ||
    String(item)
  );
}
  
function random5(min, max) {
  const min5 = Math.ceil(min / 5);
  const max5 = Math.floor(max / 5);
  return randomInt(min5, max5) * 5;
}

/**
 * Repeated success-chain count logic.
 * Starts at `starting`, then keeps adding 1 while:
 * - current chance > 0
 * - roll succeeds
 * Stops immediately on first failure.
 */
function chainCount(row) {
  let count = safeNumber(row.starting, 0);
  let current = safeNumber(row.startPercent, 0);

  while (current > 0) {
    if (rollPercent() > current) break;
    count += 1;
    current -= safeNumber(row.subOnHit, 0);
  }

  return count;
}

function countFromMinMax(row, fallbackMin = 0, fallbackMax = 0) {
  return randomInt(
    safeNumber(getField(row, 'min', 'Min'), fallbackMin),
    safeNumber(getField(row, 'max', 'Max'), fallbackMax)
  );
}

function generateListFromMinMax(row, pool, hardCap = 10, filterFn = null) {
  const count = Math.min(countFromMinMax(row), hardCap);
  const filteredPool = filterFn ? pool.filter(filterFn) : pool;

  return pickRandom(
    filteredPool || [],
    count,
    (item) => item && item.enabled !== false
  );
}

/**
 * StatRange logic:
 * - start at base
 * - roll against chance
 * - on success, add random xMin..xMax
 * - subtract subOnHit
 * - stop on first failure or <= 0
 */
function chainStat(row) {
  const base = safeNumber(getField(row, 'base', 'Base'), null);
  if (base === null) {
    throw new Error('StatRange row is missing a valid base value for CR ' + getCrValue(row));
  }

  let value = base;
  let current = safeNumber(row.chance, 0);

  while (current > 0) {
    if (rollPercent() > current) break;

    const xMin = safeNumber(getField(row, 'xMin', 'X MIN'), 0);
    const xMax = safeNumber(getField(row, 'xMax', 'X MAX'), 0);
    value += randomInt(xMin, xMax);

    current -= safeNumber(row.subOnHit, 0);
  }

  return Math.max(1, value);
}

function pickDieFromDamageRow(row) {
  const options = [row["Type Min"], row["Type Mid"], row["Type Max"]]
    .map((value) => String(value || '').trim())
    .filter((value) => value);

  if (options.length === 0) {
    return 'd4';
  }

  return options[randomInt(0, options.length - 1)];
}

  /*
  	*Helper to separate number of die from die value in edge cases of (2d4) or similar
  */
  
  function parseDieString(dieStr) {
  const clean = String(dieStr).replace(/[()]/g, '').trim();

  const match = clean.match(/^(\d+)d(\d+)$/);
  if (!match) return null;

  return {
    count: Number(match[1]),
    die: Number(match[2])
  };
}
  
/**
 * Primary damage:
 * - uses current CR row count/die info
 *
 * Secondary damage:
 * - chance comes from current CR row
 * - die type comes from 2 rows lower in DamageDiceString table (to avoid overlap with primary)
 * - row offset, not CR arithmetic
 */
function makeDamageString(data, cr) {
  const info = findByCr(data.rules.cr.DamageDiceInfo, cr);

  const count = randomInt(
    safeNumber(info["# Min"], 1),
    safeNumber(info["# Max"], 1)
  );

  const dieStr = pickDieFromDamageRow(info);
  const parsed = parseDieString(dieStr);

  let primaryDice;

  if (parsed) {
    primaryDice = `${parsed.count * count}d${parsed.die}`;
  } else {
    const die = String(dieStr).replace('d', '');
    primaryDice = `${count}d${die}`;
  }

  let secondaryDice = '';
  let secondaryDamageType = '';

  if (rollPercent() <= safeNumber(info.secondaryChancePercent, 0)) {
    const secondaryInfo = findByCrOffset(data.rules.cr.DamageDiceInfo, cr, -2);
    const secondaryDieStr = pickDieFromDamageRow(secondaryInfo);
    const secondaryParsed = parseDieString(secondaryDieStr);

    if (secondaryParsed) {
      secondaryDice = `${secondaryParsed.count}d${secondaryParsed.die}`;
    } else {
      const die = String(secondaryDieStr).replace('d', '');
      secondaryDice = `1d${die}`;
    }

    secondaryDamageType = normalizeLookupItem(
      getSingleRandom(data.rules.lookups.DamageTypesLookup, 'secondary damage')
    );
  }

  return {
    primaryDice,
    secondaryDice,
    secondaryDamageType
  };
}

function generateStats(data, cr) {
  const statRow = findByCr(data.rules.cr.StatRange, cr);

  return {
    str: chainStat(statRow),
    dex: chainStat(statRow),
    con: chainStat(statRow),
    int: chainStat(statRow),
    wis: chainStat(statRow),
    cha: chainStat(statRow)
  };
}

 /**
 * Movement generation:
 * - uses CR to determine movement speed range
 * - uses rarity to determine number of movement types
 * - walking is not guaranteed unless fallback is needed
 */
	
function generateMovement(data, cr, rarity) {
  const speedRow = findByCr(data.rules.cr.SpeedRange, cr);
  const speedChanceRow = findByRarity(data.rules.rarity.SpeedTypeChance, rarity);
	
  const speedTypes = data.rules.lookups.SpeedTypesLookup || ['Walking'];
	
  const min = safeNumber(getField(speedRow, 'min', 'Min'), 30);
  const max = safeNumber(getField(speedRow, 'max', 'Max'), 30);
	
  const guaranteed = safeNumber(getField(speedChanceRow, 'guarantee', 'Guarantee'), 1);
  const extraChance = safeNumber(getField(speedChanceRow, 'percent', '%'), 0);

  const possibleTypes = speedTypes
    .map(normalizeLookupItem)
    .filter((type) => type && type !== true);

  let count = guaranteed;

  let currentChance = extraChance;
  while (currentChance > 0) {
    if (rollPercent() > currentChance) break;
    count += 1;
    currentChance -= extraChance;
  }

  const selectedTypes = pickRandom(possibleTypes, count);

  const movements = selectedTypes.map((type) => ({
    type,
    value: random5(min, max)
  }));

  // Safety fallback (in case Guarantee is 0 or bad data)
  if (movements.length === 0) {
    return [
      {
        type: 'Walking',
        value: random5(min, max)
      }
    ];
  }

  return movements;
}

function generateSenses(data, rarity) {
  const chanceRow = findByRarity(data.rules.rarity.SensesChance, rarity);
  const distanceRow = findByRarity(data.rules.rarity.SenseDistance, rarity);

  const count = chainCount(chanceRow);

  const senseTypes = data.rules.lookups.SensesLookup || [];

  const selected = pickRandom(
    senseTypes,
    count,
    (sense) => sense && sense.enabled !== false
  );

  return selected.map((sense) => ({
    type: normalizeLookupItem(sense),
    distance: random5(
	  safeNumber(getField(distanceRow, 'min', 'Min'), 30),
  	  safeNumber(getField(distanceRow, 'max', 'Max'), 30)
    )
  }));
}

function generateSavingThrows(data, rarity, stats, profBonus) {
  const chanceRow = findByRarity(data.rules.rarity.SavingThrowTable, rarity);

  const count = chainCount(chanceRow);

  const statKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

  const selected = pickRandom(statKeys, count);

  return selected.map((stat) => ({
    stat,
    bonus: abilityMod(stats[stat]) + profBonus
  }));
}

function generateListFromChance(rarityRow, pool, hardCap = 10, filterFn = null) {
  const count = Math.min(chainCount(rarityRow), hardCap);
  const filteredPool = filterFn ? pool.filter(filterFn) : pool;
  return pickRandom(filteredPool, count, (item) => item.enabled !== false);
}

function categorizeEntries(entries = []) {
  return entries.reduce(
    (acc, entry) => {
      const key =
        entry.actionType === 'Bonus Action'
          ? 'bonusActions'
          : entry.actionType === 'Reaction'
            ? 'reactions'
            : 'actions';

      acc[key].push(entry);
      return acc;
    },
    { actions: [], bonusActions: [], reactions: [] }
  );
}

function generateLegendaryActions(rarity, sections) {
  if ((RARITY_RANK[rarity] ?? 0) < RARITY_RANK.Unique) {
    return [];
  }

  const candidates = [
    ...sections.actions
      .filter((entry) => entry.eligibleForLegendary !== false)
      .map((entry) => ({
        ...entry,
        sourceType: entry.sourceType || 'move'
      })),
    ...sections.bonusActions
      .filter((entry) => entry.eligibleForLegendary !== false)
      .map((entry) => ({
        ...entry,
        sourceType: entry.sourceType || 'move'
      })),
    ...sections.reactions
      .filter((entry) => entry.eligibleForLegendary !== false)
      .map((entry) => ({
        ...entry,
        sourceType: entry.sourceType || 'move'
      }))
  ];

  const count = randomInt(2, 3);

  return pickRandom(candidates, count).map((entry) => ({
    id: `${entry.id}-legendary`,
    name: entry.name,
    sourceType: entry.sourceType,
    sourceId: entry.id,
    description: entry.description,
    pointCost: safeNumber(entry.suggestedLegendaryCost, randomInt(1, 2))
  }));
}

function getCountryAbility(data, country, rarity) {
  return (
    data.content.countryAbilities.find(
      (ability) =>
        ability.country === country &&
        ability.rarity === rarity &&
        ability.enabled !== false
    ) || null
  );
}

function ddbText(list = []) {
  return list
    .map((item) => {
      const rangeSuffix = item.rangeText ? ` (${item.rangeText})` : '';
      return `<strong><em>${item.name}.</em></strong> ${item.description}${rangeSuffix}`;
    })
    .join('\n\n');
}

function getSingleRandom(list, fallback) {
  if (!Array.isArray(list) || list.length === 0) return fallback;
  return list[randomInt(0, list.length - 1)] ?? fallback;
}

function generateSpells(data, cr, rarity) {
  const spellLevelRow = findByCr(data.rules.cr.SpellSlotLevel, cr);
  const spellVarietyRow = findByRarity(data.rules.rarity.SpellVarietyAmount, rarity);

  const minLevel = safeNumber(getField(spellLevelRow, 'min', 'Min'), 0);
  const maxLevel = safeNumber(getField(spellLevelRow, 'max', 'Max'), 0);

  const spellCount = randomInt(
    safeNumber(getField(spellVarietyRow, 'min', 'Min'), 0),
    safeNumber(getField(spellVarietyRow, 'max', 'Max'), 0)
  );

  const validSpells = data.content.spells.filter((spell) => {
    const level = safeNumber(
      getField(spell, 'level', 'Level', 'spellLevel', 'Spell Level', 'SpellLevel'),
      null
    );

    return (
      spell.enabled !== false &&
      level !== null &&
      level >= minLevel &&
      level <= maxLevel
    );
  });
  if (validSpells.length === 0) return [];
  return pickRandom(validSpells, spellCount).map((spell) => ({
    ...deepClone(spell),
    sourceType: 'spell',
    actionType: spell.actionType || spellActionTypeFromCastingTime(spell),
    rangeText: getField(spell, 'range', 'Range') || ''
  }));
}

function getSpellUsesPerDay(data, cr) {
  const row = findByCr(data.rules.cr.SpellSlotAmount, cr);

  return randomInt(
    safeNumber(getField(row, 'min', 'Min'), 0),
    safeNumber(getField(row, 'max', 'Max'), 0)
  );
}

function getSpellcastingAbility(stats) {
  const options = [
    { key: 'int', label: 'Intelligence', mod: abilityMod(stats.int) },
    { key: 'wis', label: 'Wisdom', mod: abilityMod(stats.wis) },
    { key: 'cha', label: 'Charisma', mod: abilityMod(stats.cha) }
  ];

  return options.sort((a, b) => b.mod - a.mod)[0];
}

function getPhysicalAbility(stats) {
  const options = [
    { key: 'str', label: 'Strength', mod: abilityMod(stats.str) },
    { key: 'dex', label: 'Dexterity', mod: abilityMod(stats.dex) },
    { key: 'con', label: 'Constitution', mod: abilityMod(stats.con) }
  ];

  return options.sort((a, b) => b.mod - a.mod)[0];
}

function getMoveAttackAbility(move, stats) {
  const attackStyle = String(
    getField(move, 'attackStyle', 'Attack Style', 'AttackStyle') || ''
  ).toLowerCase();

  const physical = getPhysicalAbility(stats);
  const magical = getSpellcastingAbility(stats);

  if (attackStyle === 'magical') return magical;
  if (attackStyle === 'physical') return physical;

  return physical.mod >= magical.mod ? physical : magical;
}

function spellActionTypeFromCastingTime(spell) {
  const castingTime = String(
    getField(spell, 'castingTime', 'Casting Time', 'CastingTime') || ''
  ).toLowerCase();

  if (castingTime.includes('bonus')) return 'Bonus Action';
  if (castingTime.includes('reaction')) return 'Reaction';
  return 'Action';
}

function formatMovement(movement = []) {
  return movement
    .map((move) => `${move.type} ${move.value} ft.`)
    .join(', ');
}

function formatSenses(senses = []) {
  return senses
    .map((sense) => `${sense.type} ${sense.distance} ft.`)
    .join(', ');
}

function formatList(list = []) {
  return list.length > 0 ? list.join(', ') : '';
}

function formatSavingThrows(savingThrows = []) {
  return savingThrows
    .map(
      (save) =>
        `${save.stat.toUpperCase()} ${save.bonus >= 0 ? '+' : ''}${save.bonus}`
    )
    .join(', ');
}

function formatSkills(skills = []) {
  return skills
    .map((skill) => `${skill.name} ${skill.bonus >= 0 ? '+' : ''}${skill.bonus}`)
    .join(', ');
}

function injectMonsterName(text, monsterName) {
  if (!text) return text;

  return String(text)
    .replace(/\(monster\)/gi, monsterName)
    .replace(/\[monster\]/gi, monsterName)
    .replace(/creature/gi, monsterName);
}

function formatActionsForDDB(list = []) {
  return list
    .map((item) => {
      const name = getField(item, 'name', 'Name') || 'Unnamed Action';
      const description = getField(item, 'description', 'Description') || '';
      const range = getField(item, 'rangeText', 'range', 'Range') || '';
      const rangeSuffix = range ? ` (${range})` : '';

      const isMove = item.sourceType === 'move';

      let attackSuffix = '';

      if (isMove && item.damage) {
        const damageType =
          getField(item, 'damageType', 'Damage Type', 'dndDamageType') || '';

        attackSuffix = ` To Hit: +${item.attackBonus}. Damage: ${item.damage.primaryDice} + ${item.damageBonus}`;

        if (damageType) {
          attackSuffix += ` ${damageType} Damage`;
        }

        if (item.damage.secondaryDice) {
          attackSuffix += ` + ${item.damage.secondaryDice}`;

          if (item.damage.secondaryDamageType) {
            attackSuffix += ` ${item.damage.secondaryDamageType} Damage`;
          }
        }

        attackSuffix += '.';
      }

      return `<strong><em>${name}.</em></strong> ${description}${rangeSuffix}${attackSuffix}`;
    })
    .join('\n\n');
}

export function refreshCombatNumbers(monster) {
  const profBonus = monster.derived.proficiencyBonus;

  const spellcastingAbility = getSpellcastingAbility(monster.stats);
  const spellSaveDC = 8 + profBonus + spellcastingAbility.mod;
  const spellAttackBonus = profBonus + spellcastingAbility.mod;

  const physicalAbility = getPhysicalAbility(monster.stats);
  const physicalSaveDC = 8 + profBonus + physicalAbility.mod;

  function refreshMoveList(list = []) {
    return list.map((entry) => {
      if (entry.sourceType !== 'move' || entry.id === 'multiattack') {
        return entry;
      }

      const attackAbility = getMoveAttackAbility(entry, monster.stats);

      return {
        ...entry,
        attackAbility: attackAbility.label,
        attackBonus: profBonus + attackAbility.mod,
        damageBonus: attackAbility.mod
      };
    });
  }

  const actions = refreshMoveList(monster.actions);
  const bonusActions = refreshMoveList(monster.bonusActions);
  const reactions = refreshMoveList(monster.reactions);

  const spellcasting = {
    ...monster.spellcasting,
    ability: spellcastingAbility.label,
    abilityKey: spellcastingAbility.key,
    saveDC: spellSaveDC,
    attackBonus: spellAttackBonus
  };

  const traits = monster.traits.map((trait) =>
    trait.id === 'trait-spellcasting'
      ? {
          ...trait,
          description: `${monster.name} has ${spellcasting.usesPerDay} spell uses per day. It can expend one use to cast any spell listed in its statblock. Its spellcasting ability is ${spellcastingAbility.label} (spell save DC ${spellSaveDC}, +${spellAttackBonus} to hit with spell attacks).`
        }
      : trait
  );

  return {
    ...monster,
    actions,
    bonusActions,
    reactions,
    traits,
    spellcasting,
    derived: {
      ...monster.derived,
      physicalSaveDC,
      spellSaveDC
    },
    ddb: {
      ...monster.ddb,
      traits: ddbText(traits),
      actions: formatActionsForDDB(actions),
      bonusActions: formatActionsForDDB(bonusActions),
      reactions: formatActionsForDDB(reactions)
    }
  };
}

export function generateMonster(data, inputs) {
  const cr = inputs.cr;
  const rarity = inputs.rarity;
  const country = inputs.country;

  const monsterName = `${titleCase(rarity)} ${country.split(' ')[0]} ${randomInt(100, 999)}`;
  const hpRow = findByCr(data.rules.cr.HealthRange, cr);
  const acRow = findByCr(data.rules.cr.ACRange, cr);
  const profRow = findByCr(data.rules.cr.ProficiencyBonusLookup, cr);
  const multiattackRow = findByCr(data.rules.cr.MultiattackAmount, cr);
  const multiattackValue = randomInt(
  safeNumber(getField(multiattackRow, 'min', 'Min'), 1),
  safeNumber(getField(multiattackRow, 'max', 'Max'), 1)
  );

  const stats = generateStats(data, cr);
  const profBonus = safeNumber(getField(profRow, 'prof', 'Prof.', 'Prof'), 2);
	
  const spellcastingAbility = getSpellcastingAbility(stats);
  const spellSaveDC = 8 + profBonus + spellcastingAbility.mod;
  const spellAttackBonus = profBonus + spellcastingAbility.mod;
  const spellUsesPerDay = getSpellUsesPerDay(data, cr);
	
  const physicalAbility = getPhysicalAbility(stats);
  const physicalSaveDC = 8 + profBonus + physicalAbility.mod;
	
  const movement = generateMovement(data, cr, rarity);
  
  const resistances = generateFromChanceTable(data.rules.rarity.ResistancesChance, rarity, data.rules.lookups.DamageTypesLookup, 10);

  const vulnerabilities = generateFromChanceTable(data.rules.rarity.VulnerabilitiesChance, rarity, data.rules.lookups.DamageTypesLookup, 10);

  const immunities = generateFromChanceTable(data.rules.rarity.ImmunitiesChance, rarity, data.rules.lookups.DamageTypesLookup, 10);

  const skills = generateFromChanceTable(
    data.rules.rarity.SkillChance,
    rarity,
    data.rules.lookups.SkillLookup,
    10
    ).map((skillName) => {
      const statKey = SKILL_ABILITY_MAP[skillName];

      if (!statKey) {
        return {
          name: skillName,
          stat: null,
          bonus: profBonus
        };
      }

      return {
        name: skillName,
        stat: statKey,
        bonus: abilityMod(stats[statKey]) + profBonus
      };
  });

  const senses = generateSenses(data, rarity);

  const savingThrows = generateSavingThrows(data, rarity, stats, profBonus);

  const abilityChanceRow = findByRarity(data.rules.rarity.MonsterAbilityChance, rarity);
  const moveAmountRow = findByRarity(data.rules.rarity.MonsterMoveAmount, rarity);
  const spellEntries = generateSpells(data, cr, rarity);
  const spellcastingTrait =
  spellEntries.length > 0
    ? {
        id: 'trait-spellcasting',
        name: 'Spellcasting',
        description: `The ${monsterName} has ${spellUsesPerDay} spell uses per day and can spend one use to cast any spell listed in its statblock. Its spellcasting ability is ${spellcastingAbility.label} (spell save DC ${spellSaveDC}, +${spellAttackBonus} to hit with spell attacks).`,
        sourceType: 'trait'
      }
    : null;

  const randomAbilities = generateListFromChance(
    abilityChanceRow,
    data.content.randomAbilities,
    8
  ).map((ability) => {
    const cloned = deepClone(ability);

    return {
      ...cloned,
      sourceType: 'ability',
      name: injectMonsterName(cloned.name, monsterName),
      description: injectMonsterName(cloned.description, monsterName)
    };
  });

  const moveEntries = generateListFromMinMax(
    moveAmountRow,
    data.content.moves,
    6
  ).map((move) => {
    const clonedMove = deepClone(move);
    const attackAbility = getMoveAttackAbility(clonedMove, stats);
    const attackBonus = profBonus + attackAbility.mod;

    return {
      ...clonedMove,
      name: injectMonsterName(getField(clonedMove, 'name', 'Name'), monsterName),
      description: injectMonsterName(
        getField(clonedMove, 'description', 'Description'),
        monsterName
      ),
      sourceType: 'move',
      damage: makeDamageString(data, cr),
      attackAbility: attackAbility.label,
      attackBonus,
      damageBonus: attackAbility.mod
    };
  });

  const sections = categorizeEntries([...moveEntries, ...spellEntries]);
  if (multiattackValue > 1) {
    const multiattackEntry = {
      id: 'multiattack',
      name: 'Multiattack',
      description: `The ${monsterName} makes ${multiattackValue} attacks when it takes the Attack action.`,
      sourceType: 'move'
    };

    sections.actions = [multiattackEntry, ...sections.actions];
  }
  const countryAbility = getCountryAbility(data, country, rarity);
  const legendaryActions = generateLegendaryActions(rarity, sections);

  const hpAverage = randomInt(
    safeNumber(getField(hpRow, 'min', 'Min'), 1),
    safeNumber(getField(hpRow, 'max', 'Max'), 1)
  );

  const hpDiceCount = Math.max(1, Math.ceil(hpAverage / 8));
  const hpModifier = Math.max(0, abilityMod(stats.con) * hpDiceCount);

  const size = normalizeLookupItem(getSingleRandom(data.rules.lookups.SizeLookup, { SizeLookup: 'Medium' }));
  const creatureType = normalizeLookupItem(getSingleRandom(data.rules.lookups.CreatureTypeLookup, { Classifications: 'Monstrosity' }));
  const subtype = normalizeLookupItem(getSingleRandom(data.rules.lookups.SpeciesLookup, { SpeciesLookup: 'Hybrid' }));
	
  const armorClass = randomInt(
	  safeNumber(getField(acRow, 'min', 'Min'), 10),
	  safeNumber(getField(acRow, 'max', 'Max'), 10)
  );

  const armorType = 'Natural Armor';

  return {
    id: uuid(),
    name: monsterName,
    cr,
    rarity,
    country,
    size,
    creatureType,
    subtype,
    alignment: 'Unaligned',
    stats,
    derived: {
	  proficiencyBonus: profBonus,
	  initiativeBonus: abilityMod(stats.dex),
	  passivePerception: 10 + abilityMod(stats.wis),
	  multiattack: multiattackValue,
	  physicalSaveDC,
	  spellSaveDC
	},
	  defenses: {
		  armorClass,
		  armorType,
		  hitPoints: {
			average: hpAverage,
			formula: `${hpDiceCount}d8 + ${hpModifier}`
		  },
		  resistances,
		  vulnerabilities,
		  immunities,
		  conditionImmunities: []
	},
    spellcasting: {
	  usesPerDay: spellUsesPerDay,
	  ability: spellcastingAbility.label,
	  abilityKey: spellcastingAbility.key,
	  saveDC: spellSaveDC,
	  attackBonus: spellAttackBonus
   	},
    movement,
    skills,
    savingThrows,
    senses,
    languages: [],
    randomAbilities,
    countryAbility,
    traits: [  ...(spellcastingTrait ? [spellcastingTrait] : []), ...randomAbilities, ...(countryAbility ? [countryAbility] : [])],
    actions: sections.actions,
    bonusActions: sections.bonusActions,
    reactions: sections.reactions,
    legendaryActions,
    favorite: false,
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
	ddb: {
	  basicInfo: {
		name: monsterName,
		cr,
		rarity,
		country,
		size,
		creatureType,
		subtype,
		alignment: 'Unaligned'
	  },
		  stats,
		  armorClass: `${armorClass} (${armorType})`,
		  hitPoints: `${hpAverage} (${hpDiceCount}d8 + ${hpModifier})`,
		  movement: formatMovement(movement),
		  savingThrows: formatSavingThrows(savingThrows),
		  skills: formatSkills(skills),
		  senses: formatSenses(senses),
		  resistances: formatList(resistances),
		  vulnerabilities: formatList(vulnerabilities),
		  immunities: formatList(immunities),
		  traits: ddbText([
			...(spellcastingTrait ? [spellcastingTrait] : []),
			...randomAbilities,
			...(countryAbility ? [countryAbility] : [])
		  ]),
		  actions: formatActionsForDDB(sections.actions),
		  bonusActions: formatActionsForDDB(sections.bonusActions),
		  reactions: formatActionsForDDB(sections.reactions),
		  legendaryActions: legendaryActions
			.map(
			  (entry) =>
				`<strong><em>${entry.name} (${entry.pointCost} Actions).</em></strong> ${entry.description}`
			)
		.join('\n\n')
	}
  };
}

const CR_ORDER = ['0', '1/8', '1/4', '1/2', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'];

function crSortValue(cr) {
  const normalized = normalizeCrValue(cr);
  const index = CR_ORDER.indexOf(normalized);
  return index >= 0 ? index : 999;
}

export function sortMonsters(monsters = []) {
  const rarityOrder = ['Normal', 'Rare', 'Unique', 'Miniboss', 'Boss', 'Mythic'];

  return [...monsters].sort((a, b) => {
    if (a.country !== b.country) {
      return a.country.localeCompare(b.country);
    }

    if (a.rarity !== b.rarity) {
      return rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
    }

    return crSortValue(a.cr) - crSortValue(b.cr);
  });
}

export function updateMonster(monsters, monsterId, patch) {
  return monsters.map((monster) =>
    monster.id === monsterId
      ? { ...monster, ...patch, updatedAt: new Date().toISOString() }
      : monster
  );
}

export function createExportPackage(data, monsters) {
  return {
    ...data,
    monsters
  };
}