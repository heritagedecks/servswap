const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * This script analyzes the codebase to extract structured information
 * that can be used to train or augment an AI assistant.
 * 
 * In a production environment, this would:
 * 1. Extract code comments, docstrings, and structural information
 * 2. Parse routing logic to understand navigation
 * 3. Extract UI components and their properties
 * 4. Analyze data models and relationships
 * 5. Combine with manual documentation
 * 6. Generate vector embeddings for semantic search
 */

// Configuration
const CODEBASE_ROOT = path.join(__dirname, '..');
const OUTPUT_FILE = path.join(__dirname, '../app/utils/ai-knowledge-base.json');

// Extensions to analyze
const FILE_PATTERNS = [
  '**/*.ts',
  '**/*.tsx',
  '**/*.js',
  '**/*.jsx',
  '**/*.md',
];

// Directories to exclude
const EXCLUDE_DIRS = [
  'node_modules',
  '.next',
  'public',
  'dist',
  'build',
];

// Helper function to extract component documentation from React files
function extractComponentInfo(content, filePath) {
  // This is a simple implementation
  // A real version would use AST parsing to extract proper information
  
  const componentMatch = content.match(/export\s+(?:default\s+)?(?:function|class)\s+(\w+)/);
  const componentName = componentMatch ? componentMatch[1] : path.basename(filePath, path.extname(filePath));
  
  const propsMatch = content.match(/interface\s+(\w+Props)\s*\{([^}]+)\}/);
  let props = [];
  if (propsMatch) {
    props = propsMatch[2]
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('//'))
      .map(line => {
        // Extract name and type info
        const propMatch = line.match(/(\w+)(?:\?)?:\s*([^;]+)/);
        return propMatch ? {
          name: propMatch[1],
          type: propMatch[2].trim(),
          required: !line.includes('?:')
        } : null;
      })
      .filter(Boolean);
  }
  
  // Extract JSDoc-style comments
  const jsdocComments = [];
  const commentRegex = /\/\*\*[\s\S]*?\*\//g;
  let match;
  while ((match = commentRegex.exec(content)) !== null) {
    jsdocComments.push(match[0]);
  }
  
  return {
    componentName,
    filePath: filePath.replace(CODEBASE_ROOT, ''),
    props,
    comments: jsdocComments,
  };
}

// Helper function to extract route info
function extractRouteInfo(filePath) {
  // Check if it's a page component based on Next.js conventions
  if (filePath.includes('/app/') && filePath.includes('/page.')) {
    const routePath = filePath
      .split('/app/')[1]
      .replace('/page.tsx', '')
      .replace('/page.jsx', '')
      .replace('/page.js', '');
    
    return {
      path: '/' + routePath,
      file: filePath.replace(CODEBASE_ROOT, '')
    };
  }
  
  return null;
}

// Main function to process files
async function processCodebase() {
  // Get all matching files
  const patterns = FILE_PATTERNS.map(pattern => 
    path.join(CODEBASE_ROOT, pattern)
  );
  
  const excludePatterns = EXCLUDE_DIRS.map(dir => 
    `!${path.join(CODEBASE_ROOT, '**', dir, '**')}`
  );
  
  const files = await new Promise((resolve, reject) => {
    glob(patterns.concat(excludePatterns), (err, files) => {
      if (err) reject(err);
      else resolve(files);
    });
  });
  
  console.log(`Found ${files.length} files to analyze`);
  
  // Process each file
  const components = [];
  const routes = [];
  const pages = {};
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = file.replace(CODEBASE_ROOT, '');
    
    // Extract component info for React files
    if (file.match(/\.(jsx|tsx)$/)) {
      const componentInfo = extractComponentInfo(content, file);
      components.push(componentInfo);
    }
    
    // Extract route info
    const routeInfo = extractRouteInfo(file);
    if (routeInfo) {
      routes.push(routeInfo);
      
      // Extract page title and description
      const titleMatch = content.match(/title[:|=]\s*['"]([^'"]+)['"]/);
      const descriptionMatch = content.match(/description[:|=]\s*['"]([^'"]+)['"]/);
      
      pages[routeInfo.path] = {
        title: titleMatch ? titleMatch[1] : '',
        description: descriptionMatch ? descriptionMatch[1] : '',
        path: routeInfo.path,
        file: relativePath
      };
    }
  }
  
  // Combine everything into a knowledge base
  const knowledgeBase = {
    components,
    routes,
    pages,
    generatedAt: new Date().toISOString(),
  };
  
  // Create directory if it doesn't exist
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Write to file
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(knowledgeBase, null, 2));
  console.log(`Knowledge base generated at ${OUTPUT_FILE}`);
}

// Run the script
processCodebase().catch(err => {
  console.error('Error processing codebase:', err);
  process.exit(1);
}); 