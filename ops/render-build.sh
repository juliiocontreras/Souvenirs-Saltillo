#!/usr/bin/env bash
set -euo pipefail

npm ci
npm run build

# Next's standalone server needs these files alongside server.js.
node --input-type=module <<'NODE'
import { cpSync, existsSync } from 'node:fs';
const target = '.next/standalone';
if (!existsSync(`${target}/server.js`)) throw new Error('Missing standalone server');
cpSync('public', `${target}/public`, { recursive: true });
cpSync('.next/static', `${target}/.next/static`, { recursive: true });
console.log('Standalone server, images, CSS and JavaScript prepared.');
NODE
