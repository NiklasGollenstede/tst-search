
/* eslint-disable */

type Await<T> = T extends {
    then(onfulfilled?: (value: infer U) => unknown): unknown;
} ? U : T;

interface DeclareT {
	<ExportT>(factory: (modules: Record<string, any>) => Promise<ExportT>|ExportT): { exports: ExportT | { '': never, }, ready: Promise<ExportT>, };
	<ExportT>(modules: string[], factory: (...modules: any[]) => Promise<ExportT>|ExportT): { exports: ExportT | { '': never, }, ready: Promise<ExportT>, };
	amd: true;
}
declare const define: DeclareT;

declare const browser: any;
