import Foundation

/// Real photos for song covers (loaded at runtime; licences noted per image).
struct CoverImage {
    let url: URL
    let credit: String   // e.g. "Monument Valley · Photo: Jane Doe, CC BY-SA 4.0, Wikimedia Commons"
}

enum CoverImages {
    static let bySongID: [String: CoverImage] = [
        "fur-elise-beethoven-piano": CoverImage(url: URL(string: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Joseph_Karl_Stieler%27s_Beethoven_mit_dem_Manuskript_der_Missa_solemnis.jpg/960px-Joseph_Karl_Stieler%27s_Beethoven_mit_dem_Manuskript_der_Missa_solemnis.jpg")!, credit: "Beethoven by Joseph Karl Stieler, 1820 · Painting: Joseph Karl Stieler, Public domain, Wikimedia Commons"),
        "moonlight-sonata": CoverImage(url: URL(string: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Full_moon_partially_obscured_by_atmosphere.jpg/960px-Full_moon_partially_obscured_by_atmosphere.jpg")!, credit: "Full moon from the ISS · Photo: NASA, Public domain, Wikimedia Commons"),
        "river-flows-in-you": CoverImage(url: URL(string: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Bunica_River_-_rock_reflection_and_morning_mist_over_water-bs.jpg/960px-Bunica_River_-_rock_reflection_and_morning_mist_over_water-bs.jpg")!, credit: "Morning mist on the Bunica River · Photo: Minja Klarić, CC BY-SA 4.0, Wikimedia Commons"),
        "clair-de-lune-debussy": CoverImage(url: URL(string: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Andaman_Sea_at_night%2C_Moonset%2C_Moonlight.jpg/960px-Andaman_Sea_at_night%2C_Moonset%2C_Moonlight.jpg")!, credit: "Moonlight over the Andaman Sea · Photo: Vyacheslav Argenberg, CC BY 4.0, Wikimedia Commons"),
        "chopin-nocturne-op9": CoverImage(url: URL(string: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Fr%C3%A9d%C3%A9ric_Chopin_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_1717.jpg/960px-Fr%C3%A9d%C3%A9ric_Chopin_-_Eug%C3%A8ne_Delacroix_-_Mus%C3%A9e_du_Louvre_Peintures_RF_1717.jpg")!, credit: "Chopin by Eugène Delacroix, 1838 · Painting: Eugène Delacroix, Public domain, Wikimedia Commons"),
        "interstellar-zimmer": CoverImage(url: URL(string: "https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg")!, credit: "Interstellar film poster (Wikipedia)"),
    ]
}
