function generateKeywords(niche, city) {
    const baseNiche = niche.trim();
    const baseCity = city.trim();

    if (!baseNiche || !baseCity) return [];

    let prefixes = ["Serviços de", "Empresas de", "Melhor", "Especialista em", "Profissional", "Orçamento de"];

    const nLower = baseNiche.toLowerCase();
    if (nLower.includes('médic') || nLower.includes('clin') || nLower.includes('odont') || nLower.includes('dentis')) {
        prefixes = ["Clínica de", "Consultório de", "Melhor", "Especialista"];
    } else if (nLower.includes('advogad') || nLower.includes('direito') || nLower.includes('juridic')) {
        prefixes = ["Escritório de", "Advocacia", "Melhor", "Especialista"];
    } else if (nLower.includes('imoveis') || nLower.includes('imobiliar') || nLower.includes('corretor')) {
        prefixes = ["Corretor de", "Imobiliária", "Comprar", "Alugar"];
    }

    const setList = new Set();

    // Default patterns
    setList.add(`${baseNiche} em ${baseCity}`);
    setList.add(`${baseNiche} ${baseCity}`);

    for (const prefix of prefixes) {
        setList.add(`${prefix} ${baseNiche} em ${baseCity}`);
    }

    return Array.from(setList);
}

module.exports = { generateKeywords };
