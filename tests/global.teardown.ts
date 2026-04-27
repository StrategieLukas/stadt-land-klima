import { execSync } from 'child_process';

async function globalTeardown() {
    console.log('\nTests finished. Stopping Docker containers...');

    try {
        execSync('cd bin && ./stop.sh', {
            stdio: 'inherit'
        });
        console.log('Containers stopped successfully.');
    } catch (error) {
        console.error('Failed to stop containers:', error);
    }
}

export default globalTeardown;
