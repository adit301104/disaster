#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Starting build process...');

// Different approaches to run vite build
const buildCommands = [
    ['npx', ['vite', 'build']],
    ['node', [join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'), 'build']],
    [join(__dirname, 'node_modules', '.bin', 'vite'), ['build']],
];

async function runCommand(command, args = []) {
    return new Promise((resolve, reject) => {
        console.log(`Trying: ${command} ${args.join(' ')}`);
        
        const child = spawn(command, args, {
            stdio: 'inherit',
            shell: true,
            cwd: __dirname
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with code ${code}`));
            }
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}

async function build() {
    for (const [command, args] of buildCommands) {
        try {
            // Check if command exists (for file paths)
            if (command.includes('/') && !existsSync(command)) {
                console.log(`Skipping ${command} - file not found`);
                continue;
            }
            
            await runCommand(command, args);
            console.log('Build completed successfully!');
            return;
        } catch (error) {
            console.log(`Failed with ${command}: ${error.message}`);
            continue;
        }
    }
    
    console.error('All build attempts failed');
    process.exit(1);
}

build().catch(console.error);