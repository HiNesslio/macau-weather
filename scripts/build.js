import { mkdir, copyFile, cp, rm } from 'node:fs/promises';
await rm(new URL('../public/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await copyFile(new URL('../index.html', import.meta.url), new URL('../public/index.html', import.meta.url));
await cp(new URL('../assets/', import.meta.url), new URL('../public/assets/', import.meta.url), { recursive: true, filter: source => !source.includes('/assets/readme') });
