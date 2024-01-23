import assert, { AssertionError } from 'assert';
import { VirtualMachine } from './vm.js';

const programs = [
	[
		`SET 1 R0
		SET 1 R1
		ADD R0 R1 R2
		PRINT R2`,
		2,
	],
	[
		`SET 0 R0
		SET 10 R1
		SET 0 R2
		loop:
		INC R2
		INC R0
		NEQ R0 R1 @loop
		PRINT R2
		`,
		10,
	],
	[

		`; another blank comment
		SET 0 R0 ; comment here
		PRINT R0 ; another comment
		; another blank comment 2
		`,
		0,
	],
]


const testSuite = (examples) => {
	const output = [];
	const logger = (val) => { output.push(val); }
	const vm = new VirtualMachine({ onLog: logger });

	let passed = 0;
	for (const [program, expected] of examples) {
		vm.load(program);
		vm.run();
		const r = output.pop();
		try {
			assert(r === expected, `[${passed} / ${examples.length}] Expected ${expected} but got ${r}`);
		} catch (/** @type {AssertionError} */ err) {
			console.error(err.message);
		}
		vm.eraseMemory();
		passed++;
	}
}

testSuite(programs);
