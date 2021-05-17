
/* eslint-disable */

type Await<T> = T extends {
    then(onfulfilled?: (value: infer U) => unknown): unknown;
} ? U : T;

interface DeclareT {
	(factory: (modules: Record<string, any>) => any): any;
	(modules: string[], factory: (...modules: any[]) => any): any;
	amd: true;
}
declare const define: DeclareT;
