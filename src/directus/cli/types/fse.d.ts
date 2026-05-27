declare module 'fse' {
  import fs from 'fs';
  
  export = fs;
  
  // Extend with fse-specific methods
  export function mkdirSync(path: string, options?: fs.MakeDirectoryOptions & { recursive: boolean }): void;
  export function writeFileSync(path: string, data: any, options?: fs.WriteFileOptions): void;
  export function readFileSync(path: string, options?: fs.BaseEncodingOptions): string;
  export function existsSync(path: string): boolean;
  export function statSync(path: string): fs.Stats;
  export function readdirSync(path: string): string[];
  export function unlinkSync(path: string): void;
  export function rmdirSync(path: string): void;
}
