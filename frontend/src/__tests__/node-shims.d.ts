declare module "node:fs" {
  export interface Stats {
    isDirectory(): boolean;
  }
  export function readdirSync(path: string): string[];
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function statSync(path: string): Stats;
}

declare module "node:path" {
  export function extname(path: string): string;
  export function join(...paths: string[]): string;
  export function relative(from: string, to: string): string;
}

declare module "node:url" {
  export function fileURLToPath(url: URL | string): string;
}
