export declare const FORBIDDEN: string[];
export declare function findForbiddenInText(text: string, patterns?: string[]): string[];
export declare function scanDir(dir: string, patterns?: string[]): { file: string; patterns: string[] }[];
