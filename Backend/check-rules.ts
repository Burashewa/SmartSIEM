import { RULE_REGISTRY } from './src/rules/registry/rule.registry';

const seenIds = new Set<string>();
const deduped = [];

for (const rule of RULE_REGISTRY) {
  if (!rule?.id) {
    console.warn('Skipping rule with missing id:', rule.name);
    continue;
  }

  if (seenIds.has(rule.id)) {
    console.warn(`Duplicate rule id detected: ${rule.id}. Skipping duplicate.`);
    continue;
  }

  seenIds.add(rule.id);
  deduped.push(rule);
}

console.log(`Loaded ${deduped.length} rules out of ${RULE_REGISTRY.length}:`);
deduped.forEach(r => console.log(`- [${r.id}] ${r.name}`));
