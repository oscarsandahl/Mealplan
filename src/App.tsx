import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { db, type Protein, type Recipe } from "./db";

const proteins: Protein[] = [
  "Chicken", "Beef", "Pork", "Fish", "Seafood",
  "Vegetarian", "Vegan", "Eggs", "Other",
];

type View = "recipes" | "week";

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekKey(date = new Date()) {
  return startOfWeek(date).toISOString().slice(0, 10);
}

function previousWeekKey() {
  const d = startOfWeek();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [view, setView] = useState<View>("recipes");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [search, setSearch] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  async function loadRecipes() {
    let saved = await db.recipes.orderBy("name").toArray();
    if (!saved.length) {
      try {
        const legacy = JSON.parse(localStorage.getItem("mealplan-recipes") || "[]") as Array<Omit<Recipe, "createdAt"> & { createdAt?: string }>;
        if (legacy.length) {
          saved = legacy.map((recipe) => ({ ...recipe, createdAt: recipe.createdAt ?? new Date().toISOString() }));
          await db.recipes.bulkPut(saved);
          localStorage.removeItem("mealplan-recipes");
        }
      } catch {
        // Ignore invalid legacy data.
      }
    }
    setRecipes(saved);
  }

  useEffect(() => { void loadRecipes(); }, [refresh]);

  const filtered = useMemo(
    () => recipes.filter((recipe) =>
      recipe.name.toLowerCase().includes(search.toLowerCase()),
    ),
    [recipes, search],
  );

  async function saveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const recipe: Recipe = {
      id: editing?.id ?? crypto.randomUUID(),
      name: String(form.get("name") || "").trim(),
      ingredients: String(form.get("ingredients") || "").trim(),
      instructions: String(form.get("instructions") || "").trim(),
      cookTime: Number(form.get("cookTime") || 0),
      protein: String(form.get("protein") || "Other") as Protein,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    await db.recipes.put(recipe);
    setEditing(null);
    setShowForm(false);
    setRefresh((n) => n + 1);
  }

  async function deleteRecipe(recipe: Recipe) {
    if (!window.confirm(`Delete “${recipe.name}”? This cannot be undone.`)) return;
    await db.transaction("rw", db.recipes, db.cooked, db.menus, async () => {
      await db.recipes.delete(recipe.id);
      await db.cooked.where("recipeId").equals(recipe.id).delete();
      const menus = await db.menus.toArray();
      for (const menu of menus) {
        const recipeIds = menu.recipeIds.filter((id) => id !== recipe.id);
        await db.menus.put({ ...menu, recipeIds });
      }
    });
    setRefresh((n) => n + 1);
  }

  async function exportBackup() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      recipes: await db.recipes.toArray(),
      cooked: await db.cooked.toArray(),
      menus: await db.menus.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mealplan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.recipes) || !Array.isArray(data.cooked) || !Array.isArray(data.menus)) {
        throw new Error("Invalid backup");
      }
      if (!window.confirm("Replace your current recipes and history with this backup?")) return;
      await db.transaction("rw", db.recipes, db.cooked, db.menus, async () => {
        await db.recipes.clear();
        await db.cooked.clear();
        await db.menus.clear();
        await db.recipes.bulkPut(data.recipes);
        await db.cooked.bulkPut(data.cooked);
        await db.menus.bulkPut(data.menus);
      });
      setRefresh((n) => n + 1);
      alert("Backup restored.");
    } catch {
      alert("That file is not a valid Mealplan backup.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="app">
      <header>
        <div>
          <p className="eyebrow">YOUR KITCHEN</p>
          <h1>Mealplan</h1>
        </div>
        <button className="primary" onClick={() => { setEditing(null); setShowForm(true); }}>+ Add recipe</button>
      </header>

      <nav className="tabs">
        <button className={view === "recipes" ? "active" : ""} onClick={() => setView("recipes")}>Recipes</button>
        <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Week</button>
      </nav>

      {view === "recipes" ? (
        <main>
          <input className="search" placeholder="Search recipes…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <section className="backup-bar">
            <button className="secondary" onClick={exportBackup}>Export backup</button>
            <label className="secondary file-button">
              Import backup
              <input type="file" accept=".json,application/json" onChange={importBackup} />
            </label>
          </section>

          {filtered.length === 0 ? (
            <section className="empty">
              <div className="empty-icon">🍽️</div>
              <h2>{recipes.length ? "No matches" : "No recipes yet"}</h2>
              <p>{recipes.length ? "Try a different search." : "Add your first recipe and we'll build your menu from it."}</p>
              {!recipes.length && <button className="primary large" onClick={() => setShowForm(true)}>Add your first recipe</button>}
            </section>
          ) : (
            <div className="recipe-list">
              {filtered.map((recipe) => (
                <article className="recipe-card" key={recipe.id} role="button" tabIndex={0} onClick={() => setSelectedRecipe(recipe)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedRecipe(recipe); }}>
                  <div className="recipe-main">
                    <h2>{recipe.name}</h2>
                    <span className="recipe-open">Tap to open</span>
                    <p>{recipe.protein} · {recipe.cookTime} min</p>
                  </div>
                  <div className="recipe-actions">
                    <button className="text-button" onClick={(e) => { e.stopPropagation(); setEditing(recipe); setShowForm(true); }}>Edit</button>
                    <button className="text-button danger" onClick={(e) => { e.stopPropagation(); void deleteRecipe(recipe); }}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      ) : <Week recipes={recipes} />}
      
      {selectedRecipe && (
        <div className="modal-backdrop" onClick={() => setSelectedRecipe(null)}>
          <section className="recipe-detail" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="eyebrow">RECIPE</p>
                <h2>{selectedRecipe.name}</h2>
              </div>
              <button type="button" className="icon-button" onClick={() => setSelectedRecipe(null)}>×</button>
            </div>
            <div className="recipe-meta">
              <span>{selectedRecipe.protein}</span>
              <span>{selectedRecipe.cookTime} min</span>
            </div>
            <section className="detail-section">
              <h3>Ingredients</h3>
              <div className="recipe-text">{selectedRecipe.ingredients}</div>
            </section>
            <section className="detail-section">
              <h3>Instructions</h3>
              <div className="recipe-text">{selectedRecipe.instructions}</div>
            </section>
            <div className="detail-actions">
              <button className="secondary" onClick={() => { setEditing(selectedRecipe); setSelectedRecipe(null); setShowForm(true); }}>Edit recipe</button>
              <button className="primary large" onClick={() => setSelectedRecipe(null)}>Done</button>
            </div>
          </section>
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <form className="modal" onSubmit={saveRecipe} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? "Edit recipe" : "New recipe"}</h2>
              <button type="button" className="icon-button" onClick={() => setShowForm(false)}>×</button>
            </div>
            <label>Name<input name="name" required defaultValue={editing?.name} placeholder="e.g. Chicken curry" /></label>
            <label>Protein<select name="protein" defaultValue={editing?.protein ?? "Chicken"}>{proteins.map((protein) => <option key={protein}>{protein}</option>)}</select></label>
            <label>Cook time (minutes)<input name="cookTime" type="number" min="0" inputMode="numeric" defaultValue={editing?.cookTime || ""} placeholder="30" /></label>
            <label>Ingredients<textarea name="ingredients" required defaultValue={editing?.ingredients} placeholder={"2 chicken breasts\n1 onion\n…"} /></label>
            <label>Instructions<textarea name="instructions" required defaultValue={editing?.instructions} placeholder="How do you make it?" /></label>
            <button className="primary large" type="submit">{editing ? "Save changes" : "Save recipe"}</button>
          </form>
        </div>
      )}
    </div>
  );
}

function Week({ recipes }: { recipes: Recipe[] }) {
  const [dinners, setDinners] = useState(7);
  const [menu, setMenu] = useState<Recipe[]>([]);
  const [cookedIds, setCookedIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  async function loadWeek() {
    const saved = await db.menus.get(weekKey());
    const savedRecipes = saved ? saved.recipeIds.map((id) => recipes.find((r) => r.id === id)).filter(Boolean) as Recipe[] : [];
    setMenu(savedRecipes);
    const cooked = await db.cooked.where("cookedOn").startsWith(weekKey()).toArray();
    setCookedIds(new Set(cooked.map((item) => item.recipeId)));
    setLoaded(true);
  }

  useEffect(() => { if (recipes.length || !loaded) void loadWeek(); }, [recipes, loaded]);

  async function generate() {
    if (!recipes.length) return;
    const previous = await db.menus.get(previousWeekKey());
    const previousIds = new Set(previous?.recipeIds ?? []);
    const previousCooked = await db.cooked.toArray();
    for (const record of previousCooked) {
      if (record.cookedOn.startsWith(previousWeekKey())) previousIds.add(record.recipeId);
    }

    const shuffled = [...recipes].sort(() => Math.random() - 0.5);
    const preferred = shuffled.filter((r) => !previousIds.has(r.id));
    const pool = preferred.length >= dinners ? preferred : shuffled;
    const chosen: Recipe[] = [];
    const usedProteins = new Set<Protein>();

    for (const recipe of pool) {
      if (chosen.length >= dinners) break;
      if (!usedProteins.has(recipe.protein)) {
        chosen.push(recipe);
        usedProteins.add(recipe.protein);
      }
    }
    for (const recipe of pool) {
      if (chosen.length >= dinners) break;
      if (!chosen.some((r) => r.id === recipe.id)) chosen.push(recipe);
    }

    await db.menus.put({ weekKey: weekKey(), recipeIds: chosen.map((r) => r.id) });
    setMenu(chosen);
    setCookedIds(new Set((await db.cooked.where("cookedOn").startsWith(weekKey()).toArray()).map((r) => r.recipeId)));
  }

  async function regenerateDay(index: number) {
    const used = new Set(menu.filter((_, i) => i !== index).map((r) => r.id));
    const previous = await db.menus.get(previousWeekKey());
    const previousIds = new Set(previous?.recipeIds ?? []);
    const candidates = recipes.filter((r) => !used.has(r.id) && !previousIds.has(r.id));
    const fallback = recipes.filter((r) => !used.has(r.id));
    const pool = candidates.length ? candidates : fallback;
    if (!pool.length) return;
    const current = menu[index];
    const sameProtein = pool.filter((r) => r.protein !== current?.protein);
    const choice = (sameProtein.length ? sameProtein : pool)[Math.floor(Math.random() * (sameProtein.length ? sameProtein.length : pool.length))];
    const next = [...menu];
    next[index] = choice;
    await db.menus.put({ weekKey: weekKey(), recipeIds: next.map((r) => r.id) });
    setMenu(next);
  }

  async function markCooked(recipe: Recipe) {
    const already = await db.cooked.where("recipeId").equals(recipe.id).and((r) => r.cookedOn.startsWith(weekKey())).first();
    if (!already) await db.cooked.add({ recipeId: recipe.id, cookedOn: new Date().toISOString() });
    setCookedIds((current) => new Set(current).add(recipe.id));
  }

  return (
    <main>
      <section className="week-controls">
        <div><p className="eyebrow">MENU</p><h2>This week</h2><p className="muted">Recipes cooked last week are kept out of the next menu.</p></div>
        <label>Dinners<select value={dinners} onChange={(e) => setDinners(Number(e.target.value))}>{[1,2,3,4,5,6,7].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
      </section>

      {recipes.length === 0 ? (
        <section className="empty compact"><div className="empty-icon">🗓️</div><h2>Add recipes first</h2><p>Your weekly menu will be generated from your saved recipes.</p></section>
      ) : (
        <>
          <button className="primary large full" onClick={() => void generate()}>Generate menu</button>
          {menu.length > 0 && (
            <div className="menu-list">
              {menu.map((recipe, index) => (
                <article className="menu-day" key={`${recipe.id}-${index}`}>
                  <span className="day">Dinner {index + 1}</span>
                  <div className="menu-recipe"><strong>{recipe.name}</strong><span>{recipe.protein} · {recipe.cookTime} min</span></div>
                  <div className="menu-actions">
                    <button className={cookedIds.has(recipe.id) ? "text-button cooked" : "text-button"} onClick={() => void markCooked(recipe)}>{cookedIds.has(recipe.id) ? "✓ Cooked" : "Mark cooked"}</button>
                    <button className="text-button" aria-label={`Regenerate dinner ${index + 1}`} onClick={() => void regenerateDay(index)}>↻</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default App;
