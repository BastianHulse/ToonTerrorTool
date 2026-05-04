# Monster Generator App

Starter React + Vite project for the GitHub Pages monster generator.

## Included

* Generate tab with CR / rarity / country inputs
* Monster Library for saved monsters
* Data Editor with JSON import/export
* D\&D Beyond helper view
* Bundled normalized data package in `public/data/monster\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_generator\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\_data.json`

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## GitHub Pages

This project uses `base: './'` in `vite.config.js`, which makes it easy to deploy to GitHub Pages from the `dist` folder.

## Notes

This is a starter scaffold. The generator engine is wired to the normalized JSON package, but several advanced systems are still intentionally lightweight in this first build:

* detailed resistance / vulnerability / immunity generation
* full data-table editing UI
* fine-grained reroll controls
* polished D\&D Beyond roll syntax helpers
* autofill tooling



### **TO DO**

~~✏️ Edit existing monsters~~

~~🎲 Reroll individual stats~~

~~🧾 D\&D Beyond copy button (super useful)~~

~~🔍 Search/filter library~~

&#x20;   ~~Multiattack Generation~~

&#x20;   ~~Encounter Page (Add Monsters from Library, sort order by Initiative, add player objects to mark their order.)~~

&#x09;~~On that page:~~

&#x09;~~🧠 Mutation Button~~

&#x09;	~~Manually add/change each category to have targeted mutations~~

&#x09;~~Button to click continue with randomly rolled mutations after seeing them~~

&#x09;~~Auto pop-up Statblock tool when monster is clicked~~

&#x09;~~Add a filter for the monster add function. Categories are favorites and also each country~~

&#x20; 	~~Health Tracker for monsters and players (Able to put in a number, then click a ticker to either damage or heal)~~

🔁 Auto-fill mapping and tool (automation for DDB fields)

⚔️ Better Move Visuals/Descriptions



Questions
Rarity:

\- Should Add/Remove do anything, or should it only replace/set rarity? This should only give the option to set.

\- Should changing rarity regenerate the monster or only change the label? It should only change the label. This is then used in new values if a mutation in those other values occur



CR:

\- Should changing CR regenerate HP, AC, damage, moves, spells, etc., or only update CR? It should only set CR, then when other mutations are randomly rolled, they should be done using the new cr, just like rarity.



Health:

\- Should values like +10/-10 change max HP, current HP, or both? Additions should change max hp and heal that same amount (61/70 +10 would be 71/80), when it is subtracted currenthp should stay the same unless it is over the new max hp, then it should be lowered to max hp.



Stats:

\- Should STR +1 mean increase STR by 1? Yes, but it is important to note that there are two values for str, one is the base score and one is the ability score. if the base score is 16 then the ability score is +3, if the score is given +1 and becomes seventeen it is still +3 to the ability score. Instead of adding or removing, just let me set this one as a number I type in to get the base score.

\- Should remove mean -1? Above question answers this, just let me set my score instead of adding or subtracting.

\- Should replace random mean reroll that stat or all stats? Replace Random should reroll that individual stat.



Moves:

\- Should “Damage Type” value change the damage type of a random move?

\- Or should Moves dropdown list actual move names instead?

This one should add a random move of the chosen damage type.



Spells:

\- Should this add a spell by name, reroll spells, or change spell slot level?

This should add a random spell of the chosen level.



Skills:

\- Should add/remove directly add skill proficiencies?

Yes



Senses:

\- Should add/remove add senses like darkvision with random distance?

Yes



Damage Die:

\- Should this change the damage type, dice size, or dice count?

This should let me change damage dice size and dice count.



Saving Throws:

\- Should add/remove add save proficiency?

Yes



AC:

\- Should value +1/+2 style modify AC, or should 0–9 set AC?

Let me type in a number for this one



Multiattack:

\- Should value set number of attacks?

Yes, multiattack is a stored option for monsters



Abilities:

\- Should add/remove actual ability names?

Let me either choose one, or get a random one.



Spell Slot Level / Spell Slot #:

\- Should these change generated spellcasting data directly?

Let me manually set level spell is casted at, and how many times the creature can cast per day.

