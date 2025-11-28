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

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const originalContent = content;
  
  // Replace all occurrences
  content = content.replace(/effectiveOrgId/g, 'orgId');
  
  // Also remove isPlatformAdmin and is Impersonating destructuring from useOrgContext
  content = content.replace(
    /const\s*{\s*([^}]*,\s*)?(effectiveOrgId|orgId)(\s*,\s*[^}]*)?\s*}\s*=\s*useOrgContext\(\);/g,
    (match) => {
      // Keep only orgId and isLoading
      if (match.includes('isLoading')) {
        return 'const { orgId, isLoading } = useOrgContext();';
      }
      return 'const { orgId } = useOrgContext();';
    }
  );
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    const count = (originalContent.match(/effectiveOrgId/g) || []).length;
    totalReplacements += count;
    console.log(`✓ ${file}: ${count} replacements`);
  }
});

console.log(`\nTotal replacements: ${totalReplacements} in ${files.length} files`);
