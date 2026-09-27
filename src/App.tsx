import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Protein =
  | "Chicken" | "Beef" | "Pork" | "Fish" | "Seafood"
  | "Vegetarian" | "Vegan" | "Eggs" | "Other";

type Recipe = {
  id: string;
  name: string;
  ingredients: string;
  instructions: string;
  cookTime: number;
  protein: Protein;
  photo?: string;
};

const proteins: Protein[] = [
  "Chicken", "Beef", "Pork", "Fish", "Seafood",
  "Vegetarian", "Vegan", "Eggs", "Other",
];

const starterRecipes: Recipe[] = [];

function App() {
  const [recipes, setRecipes] = useState<Recipe[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("mealplan-recipes") || "[]");
    } catch {
      return starterRecipes;
    }
  });
  const [view, setView] = useState<"recipes" | "week">("recipes");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    localStorage.setItem("mealplan-recipes", JSON.stringify(recipes));
  }, [recipes]);

  const filtered = recipes.filter((recipe) =>
    recipe.name.toLowerCase().includes(search.toLowerCase()),
  );

  function saveRecipe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const recipe: Recipe = {
      id: crypto.randomUUID(),
      name: String(form.get("name") || ""),
      ingredients: String(form.get("ingredients") || ""),
      instructions: String(form.get("instructions") || ""),
      cookTime: Number(form.get("cookTime") || 0),
      protein: String(form.get("protein") || "Other") as Protein,
    };
    setRecipes((current) => [...current, recipe]);
    setShowForm(false);
    event.currentTarget.reset();
  }

  return (
    <div className="app">
      <header>
        <div>
          <p className="eyebrow">YOUR KITCHEN</p>
          <h1>Mealplan</h1>
        </div>
        <button className="primary" onClick={() => setShowForm(true)}>+ Add recipe</button>
      </header>

      <nav className="tabs">
        <button className={view === "recipes" ? "active" : ""} onClick={() => setView("recipes")}>Recipes</button>
        <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Week</button>
      </nav>

      {view === "recipes" ? (
        <main>
          <input
            className="search"
            placeholder="Search recipes…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          {filtered.length === 0 ? (
            <section className="empty">
              <div className="empty-icon">🍽️</div>
              <h2>No recipes yet</h2>
              <p>Add your first recipe and we'll build your menu from it.</p>
              <button className="primary large" onClick={() => setShowForm(true)}>Add your first recipe</button>
            </section>
          ) : (
            <div className="recipe-list">
              {filtered.map((recipe) => (
                <article className="recipe-card" key={recipe.id}>
                  <div>
                    <h2>{recipe.name}</h2>
                    <p>{recipe.protein} · {recipe.cookTime} min</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      ) : (
        <Week recipes={recipes} />
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <form className="modal" onSubmit={saveRecipe} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>New recipe</h2>
              <button type="button" className="icon-button" onClick={() => setShowForm(false)}>×</button>
            </div>

            <label>Name<input name="name" required placeholder="e.g. Chicken curry" /></label>
            <label>Protein<select name="protein" defaultValue="Chicken">{proteins.map((protein) => <option key={protein}>{protein}</option>)}</select></label>
            <label>Cook time (minutes)<input name="cookTime" type="number" min="0" inputMode="numeric" placeholder="30" /></label>
            <label>Ingredients<textarea name="ingredients" required placeholder={"2 chicken breasts\n1 onion\n…"} /></label>
            <label>Instructions<textarea name="instructions" required placeholder="How do you make it?" /></label>

            <button className="primary large" type="submit">Save recipe</button>
          </form>
        </div>
      )}
    </div>
  );
}

function Week({ recipes }: { recipes: Recipe[] }) {
  const [dinners, setDinners] = useState(7);
  const [menu, setMenu] = useState<Recipe[]>([]);

  function generate() {
    const available = [...recipes].sort(() => Math.random() - 0.5);
    const chosen: Recipe[] = [];
    const proteinsUsed = new Set<Protein>();

    for (const recipe of available) {
      if (chosen.length >= dinners) break;
      if (!proteinsUsed.has(recipe.protein) || chosen.length >= available.length - 1) {
        chosen.push(recipe);
        proteinsUsed.add(recipe.protein);
      }
    }

    if (chosen.length < dinners) {
      for (const recipe of available) {
        if (chosen.length >= dinners) break;
        if (!chosen.some((item) => item.id === recipe.id)) chosen.push(recipe);
      }
    }
    setMenu(chosen);
  }

  return (
    <main>
      <section className="week-controls">
        <div>
          <p className="eyebrow">MENU</p>
          <h2>Generate your week</h2>
        </div>
        <label>Dinners<select value={dinners} onChange={(event) => setDinners(Number(event.target.value))}>
          {[1,2,3,4,5,6,7].map((n) => <option key={n} value={n}>{n}</option>)}
        </select></label>
      </section>

      {recipes.length === 0 ? (
        <section className="empty compact">
          <div className="empty-icon">🗓️</div>
          <h2>Add recipes first</h2>
          <p>Your weekly menu will be generated from your saved recipes.</p>
        </section>
      ) : (
        <>
          <button className="primary large full" onClick={generate}>Generate menu</button>
          {menu.length > 0 && (
            <div className="menu-list">
              {menu.map((recipe, index) => (
                <article className="menu-day" key={recipe.id}>
                  <span className="day">Dinner {index + 1}</span>
                  <div>
                    <strong>{recipe.name}</strong>
                    <span>{recipe.protein} · {recipe.cookTime} min</span>
                  </div>
                  <button className="text-button" onClick={generate}>↻</button>
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
