import { sortMonsters } from '../lib/generator';

export default function MonsterLibrary({ monsters, onOpen, onToggleFavorite, onDelete }) {
  const sorted = sortMonsters(monsters);

  return (
    <div className="card stack">
      <h2>Monster Library</h2>
      {!sorted.length && <p className="muted">No saved monsters yet.</p>}
      {sorted.map((monster) => (
        <div key={monster.id} className="list-row">
          <div>
            <strong>{monster.name}</strong>
            <div className="muted">{monster.country} · {monster.rarity} · CR {monster.cr}</div>
          </div>
          <div className="button-row">
            <button className="ghost-button" onClick={() => onOpen(monster.id)}>Open</button>
            <button className="ghost-button" onClick={() => onToggleFavorite(monster.id)}>{monster.favorite ? '★' : '☆'}</button>
            <button className="ghost-button danger" onClick={() => onDelete(monster.id)}>Delete</button>
          </div>
        </div>
      ))}
    </div>
  );
}
