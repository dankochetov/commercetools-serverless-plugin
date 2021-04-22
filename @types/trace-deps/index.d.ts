declare module 'trace-deps' {
	type Record<K extends string | number | symbol, V> = { [key in K]: V };

	export function traceFile(params: TraceFileParams): Promise<TraceFileResult>;

	export interface TraceFileParams {
		srcPath: string;
		ignores?: string[];
		allowMissing?: Record<string, string[]>;
		bailOnMissing?: boolean;
		includeSourceMaps?: boolean;
		extraImports?: Record<string, string[]>;
	}

	export interface TraceFileResult {
		dependencies: string[];
		sourceMaps: string[];
		misses: Record<string, Miss>;
	}

	export interface Miss {
		src: string;
		start: number;
		end: number;
		loc: {
			start: { line: number; column: number };
			end: { line: number; column: number };
		};
		type: 'dynamic' | 'static' | 'extra';
		dep: string;
	}
}
