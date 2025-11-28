const fs = require('fs');
const path = require('path');

// Recursively find all TypeScript files
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory() && !filePath.includes('node_modules')) {
      findFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Replace effectiveOrgId with orgId in all files
const srcDir = path.join(__dirname, '..', 'src');
const files = findFiles(srcDir);

let totalReplacements = 0;
let filesModified = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;
  
  // Replace all occurrences of effectiveOrgId with orgId
  content = content.replace(/\beffectiveOrgId\b/g, 'orgId');
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    const count = (originalContent.match(/\beffectiveOrgId\b/g) || []).length;
    totalReplacements += count;
    filesModified++;
    console.log(`✓ ${file}: ${count} replacements`);
  }
});

console.log(`\nMigration complete!`);
console.log(`Total replacements: ${totalReplacements}`);
console.log(`Files modified: ${filesModified}`);
console.log(`\nPlease run: npm run typecheck`);
