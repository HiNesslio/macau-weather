import { mkdir, copyFile, cp } from 'node:fs/promises';
await mkdir(new URL('../public/', import.meta.url), { recursive: true });
await copyFile(new URL('../index.html', import.meta.url), new URL('../public/index.html', import.meta.url));
await cp(new URL('../assets/', import.meta.url), new URL('../public/assets/', import.meta.url), { recursive: true });
