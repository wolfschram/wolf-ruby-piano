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
        // Ruby's songs
        "twinkle-twinkle": CoverImage(url: URL(string: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/0c/The_Milky_Way_arch_in_the_steppes_of_Kazakhstan.jpg/960px-The_Milky_Way_arch_in_the_steppes_of_Kazakhstan.jpg")!, credit: "Milky Way over the steppe · Astrobond, CC BY-SA 4.0, Wikimedia Commons"),
        "baa-baa-black-sheep-midi": CoverImage(url: URL(string: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f5/Swaledale_Sheep%2C_Lake_District%2C_England_-_June_2009.jpg/960px-Swaledale_Sheep%2C_Lake_District%2C_England_-_June_2009.jpg")!, credit: "Swaledale sheep · User:Diliff, CC BY-SA 3.0, Wikimedia Commons"),
        "brahms-lullaby-piano-midi": CoverImage(url: URL(string: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/4c/Handmade_teddy_bear.jpg/960px-Handmade_teddy_bear.jpg")!, credit: "Teddy bear · Clément Bucco-Lechat, CC BY-SA 3.0, Wikimedia Commons"),
        "humpty-dumpty-midi": CoverImage(url: URL(string: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/62/Denslow%27s_Humpty_Dumpty_1904.jpg/960px-Denslow%27s_Humpty_Dumpty_1904.jpg")!, credit: "Humpty Dumpty by W. W. Denslow, 1904 · William Wallace Denslow, Public domain, Wikimedia Commons"),
        "ode-to-joy-easy": CoverImage(url: URL(string: "https://thumb.wikimedia.org/wikipedia/commons/thumb/1/1d/Fireworks_over_Ponte_Vecchio.JPG/960px-Fireworks_over_Ponte_Vecchio.JPG")!, credit: "Fireworks over Ponte Vecchio · Martin Falbisoner, CC BY-SA 3.0, Wikimedia Commons"),
        "old-macdonald-had-a-farm-midi": CoverImage(url: URL(string: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e0/Cow_on_a_farm_road%2C_Cumbrae%2C_Scotland.jpg/960px-Cow_on_a_farm_road%2C_Cumbrae%2C_Scotland.jpg")!, credit: "Cow on a farm road · Michal Klajban, CC BY-SA 4.0, Wikimedia Commons"),
        "pop-goes-the-weasel-midi": CoverImage(url: URL(string: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/30/035_Stoat_in_winter_coat_in_Parc_naturel_r%C3%A9gional_Jura_vaudois_Photo_by_Giles_Laurent.jpg/960px-035_Stoat_in_winter_coat_in_Parc_naturel_r%C3%A9gional_Jura_vaudois_Photo_by_Giles_Laurent.jpg")!, credit: "Stoat in winter coat · Giles Laurent, CC BY-SA 4.0, Wikimedia Commons"),
        "row-row-row-your-boat-midi": CoverImage(url: URL(string: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/40/Phayao_-_Small_rowing_boat_moored_on_shores_of_Phayao_Lake_Jan_2024.jpg/960px-Phayao_-_Small_rowing_boat_moored_on_shores_of_Phayao_Lake_Jan_2024.jpg")!, credit: "Rowing boat on Phayao Lake · Dominic Nelson, CC BY-SA 4.0, Wikimedia Commons"),
        "wheels-on-the-bus-midi": CoverImage(url: URL(string: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Ouachita_Parish_Schools_school_bus_at_Swartz_Elementary.jpeg/960px-Ouachita_Parish_Schools_school_bus_at_Swartz_Elementary.jpeg")!, credit: "Yellow school bus · Ktkvtsh, CC BY-SA 4.0, Wikimedia Commons"),
    ]
}
