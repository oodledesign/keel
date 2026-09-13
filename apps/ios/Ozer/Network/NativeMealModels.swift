import Foundation

struct NativeRecipesPayload: Decodable, Equatable {
    var items: [NativeRecipeItem]
    static let empty = NativeRecipesPayload(items: [])
}

struct NativeRecipeItem: Decodable, Identifiable, Equatable, Hashable {
    var id: String
    var name: String
    var description: String?
    var imageUrl: String?
    var mealType: String
    var prepMinutes: Int?
    var cookMinutes: Int?
    var servings: Int?
    var isFavorite: Bool
    var dietTags: [String]
    var tags: [String]
    var lastCookedAt: String?
    var timesCooked: Int

    enum CodingKeys: String, CodingKey {
        case id, name, description, servings, tags
        case imageUrl = "image_url"
        case mealType = "meal_type"
        case prepMinutes = "prep_minutes"
        case cookMinutes = "cook_minutes"
        case isFavorite = "is_favorite"
        case dietTags = "diet_tags"
        case lastCookedAt = "last_cooked_at"
        case timesCooked = "times_cooked"
    }

    var subtitle: String {
        var parts: [String] = []
        if isFavorite { parts.append("Favourite") }
        if timesCooked > 0 { parts.append("Cooked \(timesCooked)×") }
        let minutes = (prepMinutes ?? 0) + (cookMinutes ?? 0)
        if minutes > 0 { parts.append("\(minutes) min") }
        return parts.joined(separator: " · ")
    }
}

struct NativeRecipeDetail: Decodable, Equatable {
    var id: String
    var name: String
    var description: String?
    var ingredients: [String]
    var instructions: String?
    var imageUrl: String?
    var mealType: String
    var prepMinutes: Int?
    var cookMinutes: Int?
    var servings: Int?
    var isFavorite: Bool
    var dietTags: [String]
    var tags: [String]
    var lastCookedAt: String?
    var timesCooked: Int
    var steps: [NativeRecipeStep]
    var structuredIngredients: [NativeRecipeIngredient]

    enum CodingKeys: String, CodingKey {
        case id, name, description, ingredients, instructions, servings, tags, steps
        case imageUrl = "image_url"
        case mealType = "meal_type"
        case prepMinutes = "prep_minutes"
        case cookMinutes = "cook_minutes"
        case isFavorite = "is_favorite"
        case dietTags = "diet_tags"
        case lastCookedAt = "last_cooked_at"
        case timesCooked = "times_cooked"
        case structuredIngredients = "structured_ingredients"
    }
}

struct NativeRecipeStep: Decodable, Identifiable, Equatable {
    var id: String
    var title: String
    var content: String
    var timerSeconds: Int?

    enum CodingKeys: String, CodingKey {
        case id, title, content
        case timerSeconds = "timer_seconds"
    }
}

struct NativeRecipeIngredient: Decodable, Identifiable, Equatable {
    var id: String
    var name: String
    var amount: Double?
    var unit: String?
    var originalText: String

    enum CodingKeys: String, CodingKey {
        case id, name, amount, unit
        case originalText = "original_text"
    }
}

struct NativeMealPlanPayload: Decodable, Equatable {
    var weekStart: String
    var dates: [String]
    var members: [NativeHouseholdMember]
    var entries: [NativeMealEntry]

    enum CodingKeys: String, CodingKey {
        case dates, members, entries
        case weekStart = "week_start"
    }

    static let empty = NativeMealPlanPayload(weekStart: "", dates: [], members: [], entries: [])
}

struct NativeHouseholdMember: Decodable, Identifiable, Equatable {
    var id: String
    var displayName: String

    enum CodingKeys: String, CodingKey {
        case id
        case displayName = "display_name"
    }
}

struct NativeMealEntry: Decodable, Identifiable, Equatable {
    var id: String
    var planDate: String
    var mealType: String
    var title: String
    var recipeId: String?
    var notes: String?
    var cookMemberId: String?
    var cookMemberName: String?
    var isBatchPrep: Bool
    var leftoverSourceEntryId: String?
    var dietaryWarnings: [String]

    enum CodingKeys: String, CodingKey {
        case id, title, notes
        case planDate = "plan_date"
        case mealType = "meal_type"
        case recipeId = "recipe_id"
        case cookMemberId = "cook_member_id"
        case cookMemberName = "cook_member_name"
        case isBatchPrep = "is_batch_prep"
        case leftoverSourceEntryId = "leftover_source_entry_id"
        case dietaryWarnings = "dietary_warnings"
    }
}

struct NativeShoppingPayload: Decodable, Equatable {
    var weekStart: String
    var list: NativeShoppingList?

    enum CodingKeys: String, CodingKey {
        case list
        case weekStart = "week_start"
    }

    static let empty = NativeShoppingPayload(weekStart: "", list: nil)
}

struct NativeShoppingList: Decodable, Equatable {
    var id: String
    var skippedMeals: [String]
    var generatedAt: String
    var items: [NativeShoppingItem]

    enum CodingKeys: String, CodingKey {
        case id, items
        case skippedMeals = "skipped_meals"
        case generatedAt = "generated_at"
    }
}

struct NativeShoppingItem: Decodable, Identifiable, Equatable {
    var id: String
    var displayText: String
    var category: String
    var checked: Bool
    var inPantry: Bool
    var excluded: Bool

    enum CodingKeys: String, CodingKey {
        case id, category, checked
        case displayText = "display_text"
        case inPantry = "in_pantry"
        case excluded = "excluded"
    }
}

struct NativeShoppingToggleResult: Decodable, Equatable {
    var ok: Bool
    var id: String
    var checked: Bool
}
