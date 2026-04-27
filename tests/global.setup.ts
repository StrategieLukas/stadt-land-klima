import { execSync } from 'child_process';

export default async function globalSetup() {
  console.log('\nBackend up. Initializing database...');

  try {
    const setupScript = `
      cd bin && docker compose exec -T directus bash -c "
        ./directus-cli auth:set-token &&
        source .env &&
        ./cli/import-all.sh &&
        ./cli/import-all.sh &&
        ./directus-cli auth:set-frontend-token
      "
    `;

    execSync(setupScript, { 
      stdio: 'inherit',
      shell: '/bin/bash'
    });
    
    console.log('Directus database initialized successfully!');
  } catch (error) {
    console.error('Failed to initialize Directus database:', error);
  }

  console.log('\nDirectus database is initialized. Now waiting for Frontend (http://localhost:8080) to be ready...');

  const frontendUrl = 'http://localhost:8080';
  const maxRetries = 120;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(frontendUrl);
      if (response.ok) {
        console.log('Frontend is ready! Starting tests...\n');
        return;
      }
    } catch (error) {
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error('Frontend did not become ready in time.');
}