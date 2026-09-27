import Dexie, { type Table } from "dexie";

export type Protein =
  | "Chicken" | "Beef" | "Pork" | "Fish" | "Seafood"
  | "Vegetarian" | "Vegan" | "Eggs" | "Other";

export type Recipe = {
  id: string;
  name: string;
  ingredients: string;
  instructions: string;
  cookTime: number;
  protein: Protein;
  createdAt: string;
};

export type CookedRecord = {
  id?: number;
  recipeId: string;
  cookedOn: string;
};

export type WeekMenu = {
  weekKey: string;
  recipeIds: string[];
};

class MealplanDB extends Dexie {
  recipes!: Table<Recipe, string>;
  cooked!: Table<CookedRecord, number>;
  menus!: Table<WeekMenu, string>;

  constructor() {
    super("mealplan");
    this.version(1).stores({
      recipes: "id, name, protein",
      cooked: "++id, recipeId, cookedOn",
      menus: "weekKey",
    });
  }
}

export const db = new MealplanDB();
