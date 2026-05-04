function CopyCard({ title, value }) {
  return (
    <div className="card stack-sm">
      <div className="split-row">
        <h3>{title}</h3>
        <button className="ghost-button" onClick={() => navigator.clipboard.writeText(value || '')}>Copy</button>
      </div>
      <textarea readOnly value={value || ''} rows={6} />
    </div>
  );
}

export default function DDBHelper({ monster }) {
  if (!monster) return <div className="card">Generate a monster to see D&D Beyond helper fields.</div>;

  return (
    <div className="stack">
      <CopyCard title="Traits Description" value={monster.ddb.traits} />
      <CopyCard title="Actions Description" value={monster.ddb.actions} />
      <CopyCard title="Bonus Actions Description" value={monster.ddb.bonusActions} />
      <CopyCard title="Reactions Description" value={monster.ddb.reactions} />
      <CopyCard title="Legendary Actions Description" value={monster.ddb.legendaryActions} />
      <CopyCard title="Movement" value={monster.movement.map((m) => `${m.type}: ${m.value} ft.`).join('\n')} />
      <CopyCard title="Basic Info" value={`Name: ${monster.name}\nSize: ${monster.size}\nType: ${monster.creatureType}\nSubtype: ${monster.subtype}\nAlignment: ${monster.alignment}\nCR: ${monster.cr}`} />
    </div>
  );
}
