const fs = require('fs');
const { doubleMetaphone } = require('double-metaphone');
const natural = require('natural');

// Cognitive complexity factors
function calculateComplexity(name) {
  const factors = {
    length: Math.min(1, name.length / 10), // Longer names are harder (0-1 scale)
    syllableCount: (name.match(/[aeiouy]+/gi) || []).length / 5, // More syllables = harder
    nonStandardChars: ([...name].filter(c => !/[a-z]/.test(c.toLowerCase())).length / 3),
    orthoNeighbors: 1 - (natural.JaroWinklerDistance(name, 'standard')), // How "different" spelling is
    phoneticDensity: 0 // Will be calculated later
  };
  return Object.values(factors).reduce((a, b) => a + b, 0);
}

// Read and parse data
const data = fs.readFileSync('Data2.txt', 'utf8');
const entries = data.split('\n')
  .filter(line => line.trim())
  .map(line => {
    const [name, value] = line.split(',');
    return {
      name,
      value: parseInt(value, 10),
      complexity: calculateComplexity(name)
    };
  });

// Build phonetic index
const phoneticMap = new Map();
entries.forEach(entry => {
  const code = doubleMetaphone(entry.name).join('|');
  if (!phoneticMap.has(code)) phoneticMap.set(code, []);
  phoneticMap.get(code).push(entry);
});

// Create clusters (minimum 2 names)
const clusters = [];
for (const [code, group] of phoneticMap) {
  if (group.length > 1) {
    clusters.push({
      names: group.map(e => e.name),
      entries: group,
      phoneticCode: code,
      avgValue: group.reduce((a, b) => a + b.value, 0) / group.length,
      avgComplexity: group.reduce((a, b) => a + b.complexity, 0) / group.length,
      confusionScore: calculateConfusionScore(group)
    });
  }
}

function calculateConfusionScore(group) {
  const names = group.map(e => e.name);
  const complexities = group.map(e => e.complexity);
  
  // Score components (0-1 scale)
  const factors = {
    sizePenalty: Math.min(1, names.length / 5), // Larger groups are more confusing
    complexity: Math.min(1, Math.max(...complexities)),
    valueSpread: 1 - (Math.min(...group.map(e => e.value)) / Math.max(...group.map(e => e.value))),
    orthoDiversity: calculateOrthographicDiversity(names)
  };
  
  // Weighted average
  return (factors.sizePenalty * 0.3) + 
         (factors.complexity * 0.4) + 
         (factors.valueSpread * 0.2) +
         (factors.orthoDiversity * 0.1);
}

function calculateOrthographicDiversity(names) {
  const samples = names.slice(0, 5); // Compare up to 5 names
  let totalDiff = 0;
  let comparisons = 0;
  
  for (let i = 0; i < samples.length; i++) {
    for (let j = i + 1; j < samples.length; j++) {
      totalDiff += natural.LevenshteinDistance(samples[i], samples[j]) / 
                  Math.max(samples[i].length, samples[j].length);
      comparisons++;
    }
  }
  
  return comparisons > 0 ? totalDiff / comparisons : 0;
}

// Sort by confusion score (descending)
clusters.sort((a, b) => b.confusionScore - a.confusionScore);

// Generate report
let report = `Phonetic Confusion Analysis (${clusters.length} clusters)\n`;
report += `===================================\n\n`;

clusters.forEach((cluster, idx) => {
  report += `Cluster #${idx + 1} (Score: ${cluster.confusionScore.toFixed(2)})\n`;
  report += `Phonetic Code: ${cluster.phoneticCode}\n`;
  report += `Avg Value: ${cluster.avgValue.toFixed(0)} | `;
  report += `Avg Complexity: ${cluster.avgComplexity.toFixed(2)}\n`;
  report += `Names (${cluster.names.length}): ${cluster.names.join(', ')}\n\n`;
  
  // Add confusion rationale
  report += `Confusion Factors:\n`;
  report += `- Group Size: ${cluster.names.length} names\n`;
  report += `- High Complexity: ${cluster.entries.filter(e => e.complexity > 0.6).length} difficult names\n`;
  report += `- Value Spread: ${Math.min(...cluster.entries.map(e => e.value))} to ${Math.max(...cluster.entries.map(e => e.value))}\n`;
  report += `- Orthographic Diversity: ${calculateOrthographicDiversity(cluster.names).toFixed(2)}\n\n`;
});

// Save results
fs.writeFileSync('name_confusion_analysis.txt', report);
console.log(`Analysis complete. Found ${clusters.length} confusing clusters.`);