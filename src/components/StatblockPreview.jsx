function StatRow({ label, value }) {
  return (
    <div className="stat-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EntryList({ title, entries, formatter }) {
  if (!entries?.length) return null;
  return (
    <section className="stack-sm">
      <h4>{title}</h4>
      {entries.map((entry) => (
        <p key={entry.id || entry.name}><strong>{entry.name}.</strong> {formatter ? formatter(entry) : entry.description}</p>
      ))}
    </section>
  );
}

export default function StatblockPreview({ monster }) {
  if (!monster) return <div className="card">Generate a monster to see the statblock.</div>;

  return (
    <div className="card parchment stack">
      <div>
        <h1>{monster.name}</h1>
        <p className="muted">{monster.size} {monster.creatureType} ({monster.subtype}), {monster.alignment}</p>
      </div>
      <div className="stats-grid">
        <StatRow label="Armor Class" value={`${monster.defenses.armorClass} (${monster.defenses.armorType})`} />
        <StatRow label="Hit Points" value={`${monster.defenses.hitPoints.average} (${monster.defenses.hitPoints.formula})`} />
        <StatRow label="Speed" value={monster.movement.map((m) => `${m.type} ${m.value} ft.`).join(', ')} />
      </div>
      <div className="ability-grid">
        {Object.entries(monster.stats).map(([key, value]) => (
          <div key={key} className="ability-box">
            <span>{key.toUpperCase()}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="stats-grid">
        <StatRow label="Challenge" value={monster.cr} />
        <StatRow label="Proficiency Bonus" value={`+${monster.derived.proficiencyBonus}`} />
        <StatRow label="Passive Perception" value={monster.derived.passivePerception} />
        <StatRow label="Save DC" value={monster.derived.saveDC} />
      </div>
      <EntryList title="Traits" entries={monster.traits} />
      <EntryList title="Actions" entries={monster.actions} formatter={(entry) => `${entry.description} ${entry.damage ? `Hit: ${entry.damage} ${entry.dndDamageType.toLowerCase()} damage.` : ''}`} />
      <EntryList title="Bonus Actions" entries={monster.bonusActions} formatter={(entry) => entry.description} />
      <EntryList title="Reactions" entries={monster.reactions} formatter={(entry) => entry.description} />
      <EntryList title="Legendary Actions" entries={monster.legendaryActions} formatter={(entry) => `${entry.description} (${entry.pointCost} action${entry.pointCost > 1 ? 's' : ''}).`} />
    </div>
  );
}
