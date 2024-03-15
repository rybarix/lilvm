# lilVM

- lilVM is implementation of small virtual machine including tokenizer, parser and vm itself.
- lilVM does not try emulate real hardware or CPU

## Running the VM

Either go to [lilVM online playground](http://rybarix.github.io/lilvm)

or run locally:

```js
import { VirtualMachine } from './vm.js';
const vm = new VirtualMachine({ onLog: (value) => {
	 console.info(value) // onLog is called when `PRINT :REGISTER:` is called.
	},
	registerCount: 10, // registers = Int32Array(10) (10 is max)
	memorySize: 1024, // memory = Int32Array(1024)
	maxSteps: 10000, // avoiding infinite loops
});
vm.load(`YOUR CODE HERE`);
vm.run();
```

## Supported instructions

Available registers by default: `R0` - `R9`.


|Instruction|:Description|
|:-------------|:-------------|
|`INC` RX 	| Increments value at register RX |
|`DEC` RX 	| Decrements value at register RX |
|`SET` :number: RX 	| Sets decimal number value in register RX |
|`LOAD` RA RD 	| Loads value from memory at address RA (register value) to destination register RD. |
|`LOADIM` :number: RD 	| Loads decimal number value to destination register RD. |
|`STORE` RA RV 	| Stores value to memory at address RA (register value) from value register RV. |
|`EQ` RX RY @:label: 	| Compares RX, RY values and if RX == RY jumps to @:label: |
|`NEQ` RX RY @:label: 	| Compares RX, RY values and if RX != RY jumps to @:label: |
|`LT` RX RY @:label: 	| Compares RX, RY values and if RX < RY jumps to @:label: |
|`LTE` RX RY @:label: 	| Compares RX, RY values and if RX <= RY jumps to @:label: |
|`GT` RX RY @:label: 	| Compares RX, RY values and if RX > RY jumps to @:label: |
|`GTE` RX RY @:label: 	| Compares RX, RY values and if RX >= RY jumps to @:label: |
|`ADD` RA RB RC 	| Adds registers RA, RB. RC = RA + RB |
|`SUB` RA RB RC 	| Subtracts registers RA, RB. RC = RA - RB. |
|`MUL` RA RB RC 	| Integer multiplication of registers RA, RB. RC = RA * RB. |
|`DIV` RA RB RC 	| Integer division of registers RA, RB. RC = RA / RB. |
|`MOD` RA RB RC 	| Mod division of registers RA, RB. RC = RA % RB. |

## Limitations
- Integer overflows are not handled.
- Supports only integer arithmetic.
- Writing out of bounds memory is undefined behavior.

## Example program

```txt
SET 0 R0            ; init registers for loop
SET 100 R1

looplab:            ; loop label

STORE R0 R0         ; at addr R0 store R0
INC R0              ; increment R0

NEQ R0 R1 @looplab  ; if R0 != R1 jump
```
