// Garante que a imagem Docker do Playwright nos workflows usa a MESMA versão do @playwright/test.
// Versões diferentes = browsers diferentes = resultados diferentes entre local e CI.
// Roda no CI (primeiro passo) e localmente com `npm run check:versions`.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const expected = pkg.devDependencies['@playwright/test'];

if (!/^\d+\.\d+\.\d+$/.test(expected)) {
  console.error(`✖ @playwright/test deve ter versão exata no package.json (sem ^ ou ~). Atual: "${expected}"`);
  process.exit(1);
}

const dir = '.github/workflows';
let problems = 0;
let found = 0;
for (const file of readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))) {
  const content = readFileSync(join(dir, file), 'utf8');
  for (const [, version] of content.matchAll(/mcr\.microsoft\.com\/playwright:v([\w.-]+?)-(?:noble|jammy|resolute)\b/g)) {
    found++;
    if (version !== expected) {
      console.error(`✖ ${file}: imagem playwright:v${version}, mas package.json tem @playwright/test ${expected}`);
      problems++;
    }
  }
}

if (!found) {
  console.error(`✖ Nenhuma imagem mcr.microsoft.com/playwright encontrada em ${dir}`);
  process.exit(1);
}
if (problems) process.exit(1);
console.log(`✔ Imagem Docker do Playwright e @playwright/test na mesma versão (${expected}).`);
