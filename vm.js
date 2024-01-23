/** Bastardized grammar notation:
                    S -> STMT* | EOF
                STMT - > LABELLED_INSTRUCTION | INSTRUCTION
 LABELLED_INSTRUCTION -> LABEL INSTRUCTION
          INSTRUCTION -> INC | SET | LOAD | PRINT | STORE | EQ
                 INC  -> "INC" REGISTER
								 DEC  -> "DEC" REGISTER
                 SET  -> "SET" NUMBER REGISTER
                LOAD  -> "LOAD" REGISTER REGISTER
							 LOADIM -> "LOADIM" NUMBER REGISTER
			         STORE  -> "STORE" REGISTER REGISTER
			            EQ  -> "EQ" REGISTER REGISTER ALPHA
			         ALPHA  -> a-z
			         LABEL  -> ALPHA ":"
							   ADD  -> "ADD" REGISTER REGISTER REGISTER
							   SUB  -> "SUB" REGISTER REGISTER REGISTER
							   MUL  -> "MUL" REGISTER REGISTER REGISTER
								 DIV  -> "DIV" REGISTER REGISTER REGISTER
								 MOD  -> "MOD" REGISTER REGISTER REGISTER
             REGISTER -> "R0" | "R1" | "R2" | "R3"
               NUMBER -> [0-9]+
 */


/**
 * @typedef {{type: string, text: string, literal: object, line: number}} Token
 * @typedef {{ instruction: 'INC' | 'LOAD' | 'LOADIM' | 'SET' | 'PRINT' | 'STORE' | 'EQ' | 'NEQ' | 'ADD' | 'SUB' | 'DIV' | 'MUL' | 'MOD', args: any[]}} VMStatement
 * @typedef {{ instruction: 'INC' | 'LOAD' | 'LOADIM' | 'SET' | 'PRINT' | 'STORE' | 'EQ' | 'NEQ' | 'ADD' | 'SUB' | 'DIV' | 'MUL' | 'MOD', args: any[], label: string|null }} VMLabelledStatement
 * @typedef {{ instruction: 'INC' | 'LOAD' | 'LOADIM' | 'SET' | 'PRINT' | 'STORE' | 'EQ' | 'NEQ' | 'ADD' | 'SUB' | 'DIV' | 'MUL' | 'MOD', args: any[]}} VMInstruction
 * @typedef {{ onLog: (output: number) => void | null, registerCount: number, memorySize: number, maxSteps: number }} InterpreterSettings
 */

/**
 * Error reporting to user
 * @param {number} line where error happened
 * @param {string} message useful info about it
 */
function err(line, message) {
	console.error(`L${line} Error: '${message}'`);
}

class Scanner {
	#source = ""
	#tokens = [];
	#start = 0;
	#current = 0;
	#line = 1;

	/**
	 * @param {string} source source code
	 */
	constructor(source) {
		this.#source = source;
	}

	#keywords = {
		INC: 'INC',
		DEC: 'DEC',
		SET: 'SET',
		LOAD: 'LOAD',
		LOADIM: 'LOADIM',
		PRINT: 'PRINT',
		STORE: 'STORE',
		EQ: 'EQ',
		NEQ: 'NEQ',
		LTE: 'LTE',
		LT: 'LT',
		GTE: 'GTE',
		GT: 'GT',
		ADD: 'ADD',
		SUB: 'SUB',
		MUL: 'MUL',
		DIV: 'DIV',
		MOD: 'MOD',
	}

	/**
	 * @param {string} type
	 * @param {object} literal value
	 */
	addToken(type, literal) {
		this.#tokens.push({
			type,
			literal,
			line: this.#line,
			text: this.#source.substring(this.#start, this.#current),
		})
	}

	scanTokens() {
		while (!this.isAtEnd()) {
			this.#start = this.#current
			this.scanToken();
		}

		this.addToken('EOF', '');
		return this.#tokens;
	}

	scanToken() {
		const c = this.advance();
		switch(c) {
			case '-':
				this.number(true);
				break;
			case ';':
				this.comment();
				break;
			case '\n':
				this.#line++;
				break;
			// Ignore white space
			case ' ':
			case '\t':
			case '\r':
				break;
			case 'R': {
				const digit = this.peek()
				if (this.isDigit(digit)) {
					this.addToken('REGISTER', +digit)
					this.advance();
				} else {
					// console.log(digit, this.#current)
					err(this.#line, `Invalid register: R${digit}`);
				}
			}
			break;
			case '@': {
				// JUMP_TO_LABEL
				this.jumpToLabel();
			}
			break;
			default:
				if (this.isDigit(c)) {
					this.number();
				} else if (this.isAlpha(c)) {
					this.identifier();
				}
		}

	}

	jumpToLabel() {
		while(this.isAlpha(this.peek())) this.advance();
		this.addToken('JUMP_TO_LABEL', this.#source.substring(this.#start + 1, this.#current))
	}

	comment() {
		while(this.peek() !== '\n') this.advance();
	}

	identifier() {
		while(this.isAlpha(this.peek())) this.advance();

		if (this.isLabel()) {
			// store label, but omit ':'
			this.addToken('LABEL', this.#source.substring(this.#start, this.#current))
			return;
		}

		const text = this.#source.substring(this.#start, this.#current);
		const type = text in this.#keywords ? this.#keywords[text] : null

		if (type === null) {
			err(this.#line, `Invalid identifier ${text}`);
			return; // early exit
		}

		this.addToken(type, null);
	}

	isLabel() {
		return this.#source[this.#current] === ':';
	}

	number() {
		while(this.isDigit(this.peek())) this.advance();
		const num =  Number.parseInt(this.#source.substring(this.#start , this.#current));
		this.addToken('NUMBER', num);
	}

	/**
	 * @param {string} c
	 */
	isDigit(c) {
		return c >= '0' && c <= '9';
	}

	/**
	 * @param {string} c
	 */
	isAlpha(c) {
		// THINK: we may support lowercase instructions
		return c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z';
	}

	advance() {
		return this.#source.charAt(this.#current++);
	}

	peek() {
		if (this.isAtEnd()) return '\0';
		return this.#source.charAt(this.#current);
	}

	peekNext() {
		if (this.#current + 1 >= this.#source.length) return '\0';
		return this.#source.charAt(this.#current + 1);
	}

	isAtEnd() {
		return this.#current >= this.#source.length;
	}
}

class Parser {
	/**
	 * @type {Token[]}
	 */
	#tokens = [];
	#current = 0; // current token
	/**
	 * @param {Token[]} tokens
	 */
	constructor(tokens) {
		this.#tokens = tokens;
	}

	parse() {
		let statements = []

		this.labelParityCheck();

		while (!this.isAtEnd()) {
			statements.push(this.parseInstruction());
		}

		statements = this.labelResolution(statements);

		return statements;
	}

	/**
	 * @param {VMLabelledStatement} instr
	 */
	isComparisonOp(instr) {
		return (
			instr.instruction === 'EQ' ||
			instr.instruction === 'NEQ' ||
			instr.instruction === 'LT' ||
			instr.instruction === 'GT' ||
			instr.instruction === 'LTE' ||
			instr.instruction === 'GTE'
		);
	}

	/**
	 * Resolve label's program counters for VM.
	 * @param {VMLabelledStatement[]} statements
	 */
	labelResolution(statements) {
		/** @type {{[key: string]: number}} */
		const table = {} // [LABEL]: PC

		for (let i = 0; i < statements.length; i++) {
			if (statements[i].label !== null)
				table[statements[i].label] = i
		}

		// Replace all labels with actual instruction indexes (program counter)
		for (let i = 0; i < statements.length; i++) {
			if (this.isComparisonOp(statements[i])) {
				const jumpToLabel = statements[i].args[2];
				statements[i].args[2] = table[jumpToLabel];
			}
		}

		return statements;
	}

	/**
	 * Checks whether all labels we are jumping exist.
	 */
	labelParityCheck() {
		const table = {}
		for (const t of this.#tokens) {
			if (t.type === 'JUMP_TO_LABEL') table[t.literal] = false
		}

		for (const t of this.#tokens) {
			if (t.type === 'LABEL' && t.literal in table) table[t.literal] = true;
		}

		for (const [label, visited] of Object.entries(table)) {
			// Report error of missing label
			if (!visited) throw new Error(`Missing declared label ${label}`);
		}
	}

	/**
	 * @returns {VMLabelledStatement}
	 */
	parseInstruction() {
		if (this.peek().type === 'LABEL') {
			return this.labelledInstruction();
		}

		return this.instruction();
	}

	/**
	 * @returns {VMLabelledStatement}
	 */
	labelledInstruction() {
		const label = this.consume('LABEL', 'Expecting label in labelled instruction');
		return this.instruction(label.literal);
	}

	/**
	 * @param {string?} label
	 * @returns {VMLabelledStatement}
	 */
	instruction(label) {
		let vmInstr = null;
		if (this.match('INC'))
			vmInstr = this.incStatement();
		else if (this.match('DEC'))
			vmInstr = this.decStatement();
		else if (this.match('LOADIM'))
			vmInstr = this.loadimStatement();
		else if (this.match('LOAD'))
			vmInstr = this.loadStatement();
		else if (this.match('SET'))
			vmInstr = this.setStatement();
		else if (this.match('PRINT'))
			vmInstr = this.printStatement();
		else if (this.match('STORE'))
			vmInstr = this.storeStatement();
		else if (this.match('EQ', 'NEQ', 'LT', 'GT', 'LTE', 'GTE')) {
			// get previous token
			const token = this.#tokens[this.#current - 1];
			vmInstr = this.comparisonStatement(token.type);
		}
		else if (this.match('ADD', 'SUB', 'MUL', 'DIV', 'MOD')) {
			const token = this.#tokens[this.#current - 1];
			vmInstr = this.binaryOp(token.type);
		}
		else
			throw new Error(`Invalid instruction ${this.peek().text}`)

		vmInstr.label = label;

		return vmInstr;
	}

	/**
	 * @param {'ADD' | 'SUB' | 'MUL' | 'DIV' | 'MOD'} op
	 * @return {VMStatement}
	 */
	binaryOp(op) {
		const ra = this.consume('REGISTER');
		const rb = this.consume('REGISTER');
		const rdest = this.consume('REGISTER');
		return { instruction: op, args: [ra.literal, rb.literal, rdest.literal] };
	}

	/**
	 * @returns {VMStatement}
	 */
	incStatement() {
		const register = this.consume('REGISTER');
		return { instruction: 'INC', args: [register.literal] };
	}

	/**
	 * @returns {VMStatement}
	 */
	decStatement() {
		const register = this.consume('REGISTER');
		return { instruction: 'DEC', args: [register.literal] };
	}

	loadimStatement() {
		const number = this.consume('NUMBER');
		const register = this.consume('REGISTER');
		return { instruction: 'LOAD', args: [number.literal, register.literal] };
	}

	/**
	 * @returns {VMStatement}
	 */
	loadStatement() {
		const register1 = this.consume('REGISTER');
		const register2 = this.consume('REGISTER');
		return { instruction: 'LOAD', args: [register1.literal, register2.literal] };
	}

	/**
	 * @returns {VMStatement}
	 */
	storeStatement() {
		const address = this.consume('REGISTER');
		const register = this.consume('REGISTER');
		return { instruction: 'STORE', args: [address.literal, register.literal] };
	}

	/**
	 * @returns {VMStatement}
	 */
	setStatement() {
		const number = this.consume('NUMBER');
		const register = this.consume('REGISTER');
		return { instruction: 'SET', args: [number.literal, register.literal] };
	}

	/**
	 * @returns {VMStatement}
	 */
	printStatement() {
		const register = this.consume('REGISTER');
		return { instruction: 'PRINT', args: [register.literal] };
	}

	/**
	 * @param {'EQ' | 'NEQ' | 'GT' | 'LT' | 'GTE' | 'LTE'} instruction
	 * @returns {VMStatement}
	 */
	comparisonStatement(instruction) {
		const register1 = this.consume('REGISTER');
		const register2 = this.consume('REGISTER');
		const label = this.consume('JUMP_TO_LABEL');
		return { instruction, args: [register1.literal, register2.literal, label.literal] };
	}

	/**
	 * @returns {VMStatement}
	 */
	labelStatement() {
		const label = this.consume('LABEL');
		return { instruction: 'LABEL', args: [label.literal] }
	}

	/**
	 * @param {string} type expected token to consume
	 * @param {string} msg err message when expected token is not found
	 */
	consume(type, msg) {
		if (this.check(type)) return this.advance()
		throw new Error(`Erorr: ${msg}`); // todo add faulty token
	}

	/**
	 * @param {string} type token type
	 */
	check(type) {
		if (this.isAtEnd()) {
			return false;
		}

		return this.peek().type === type;
	}

	/**
	 * @returns {Token}
	 */
	advance() {
		if (!this.isAtEnd())
			this.#current++;
		return this.previous();
	}

	/**
	 * @returns {Token}
	 */
	peek() {
		return this.#tokens[this.#current];
	}

	peekNext() {
		if (this.#current + 1 >= this.#tokens.length) {
			return this.#tokens[this.#tokens.length - 1]
		}
		return this.#tokens[this.#current + 1];
	}

	/**
	 * @returns {Token}
	 */
	previous() {
		if (this.#current === 0) {
			throw new Error('Unable to call previous');
		}
		return this.#tokens[this.#current - 1];
	}

	/**
	 * @param  {...Token} tokens
	 */
	match(...tokens) {
		for (const t of tokens) {
			if (this.check(t)) {
				this.advance();
				return true;
			}
		}

		return false;
	}

	isAtEnd() {
		return this.#tokens[this.#current].type === 'EOF';
	}
}

export class VirtualMachine {
	/** @type {VMInstruction[]} */
	#program
	/** @type {Int32Array} */
	#mem
	/** @type {Int32Array} */
	#_mem
	/** @type {Int32Array} */
	#reg
	/** @type {Int32Array} */
	#_reg
	/** @type {number} */
	#pc
	/** @type {(output: number) => void | null} */
	#onLog
	/** @type {number} */
	#maxSteps

	/**
	 * @param {InterpreterSettings} settings
	 */
	constructor(settings) {
		this.#_mem = new Int32Array(settings?.memorySize ?? 1024);
		if (settings.registerCount <= 0 || settings.registerCount > 10) throw new Error('Invalid number of registers');
		this.#_reg = new Int32Array(settings?.registerCount ?? 4); // Defaults R0, R1, R2, R3
		this.#pc = 0
		this.#maxSteps = settings.maxSteps || Infinity
		this.#onLog = settings?.onLog ?? null

		// Allows #mem be replacable with proxy using watchMemory
		this.#mem = this.#_mem;
		this.#reg = this.#_reg

	}

	/**
	 * @param {string} program
	 * @param {boolean} resetPC resets PC. Useful setting for step-based execution.
	 */
	load(program, resetPC = true) {
		const scanner = new Scanner(program);
		const parser = new Parser(scanner.scanTokens());
		const vmInstructions = parser.parse();
		this.#program = vmInstructions;

		if (resetPC) {
			this.#pc = 0;
		}
	}

	/**
	 * When memory changes, calls callback.
	 * @param {(value: number, memIndex: number) => void} callback
	 */
	watchMemory(callback) {
		const observableMemory = {
			get(target, prop) {
				return target[Number(prop)];
			},
			set(target, prop, value) {
				target[Number(prop)] = value;
				callback(target[Number(prop)], Number(prop));
				return true;
			}
		};

		// replace memory with observable proxy
		this.#mem = new Proxy(this.#_mem, observableMemory);
	}

	/**
	 * When memory changes, calls callback.
	 * @param {(value: number, regIdx: number) => void} callback
	 */
	watchRegisters(callback) {
		const observableRegisters = {
			get(target, prop) {
				return target[Number(prop)];
			},
			set(target, prop, value) {
				target[Number(prop)] = value;
				callback(target[Number(prop)], Number(prop));
				return true;
			}
		};

		// replace memory with observable proxy
		this.#reg = new Proxy(this.#_reg, observableRegisters);
	}

	eraseRegisters() {
		this.#_reg.fill(0);
	}

	eraseMemory() {
		this.#_mem.fill(0);
	}

	/**
	 * @param {number} pc
	 */
	setPC(pc) {
		this.#pc = pc;
	}

	/**
	 * @return {VMInstruction}
	 */
	nextInstruction() {
		return this.#program[this.#pc];
	}

	/**
	 *
	 * @param {'LT' | 'GT' | 'NEQ' | 'EQ' | 'LTE' | 'GTE'} type
	 * @param {any[]} args
	 */
	#alu(type, args) {
		const [rx, ry, pc] = args;
		let shouldJump;
		switch (type) {
			case 'EQ':
				shouldJump = this.#reg[rx] === this.#reg[ry];
			break;
			case 'NEQ':
				shouldJump = this.#reg[rx] !== this.#reg[ry];
			break;
			case 'LT':
				shouldJump = this.#reg[rx] < this.#reg[ry];
			break;
			case 'GT':
				shouldJump = this.#reg[rx] > this.#reg[ry];
			break;
			case 'GTE':
				shouldJump = this.#reg[rx] >= this.#reg[ry];
			break;
			case 'LTE':
				shouldJump = this.#reg[rx] <= this.#reg[ry];
			break;
		}

		return { shouldJump, pc };
	}

	#executeAll() {
		let steps = 0;
		while (this.#pc < this.#program.length && steps < this.#maxSteps) {
			this.#executeStep();
			steps++;
		}
	}

	#executeStep() {
		const { instruction, args } = this.#program[this.#pc];

		switch (instruction) {
			case 'INC': {
				const [rx] = args;
				this.#reg[rx]++;
			}
			break;
			case 'DEC': {
				const [rx] = args;
				this.#reg[rx]--;
			}
			break;
			case 'SET': {
				const [val, rx] = args;
				this.#reg[rx] = val;
			}
			break;
			case 'LOADIM': {
				const [addr, rx] = args;
				this.#reg[rx] = this.#mem[addr];
			}
			break;
			case 'LOAD': {
				const [ra, rx] = args;
				this.#reg[rx] = this.#mem[this.#reg[ra]];
			}
			break;
			case 'STORE': {
				const [ra, rx] = args;
				this.#mem[this.#reg[ra]] = this.#reg[rx];
			}
			break;
			case 'PRINT': {
				const [rx] = args;
				this.#onLog(this.#reg[rx]);
			}
			break;
			case 'ADD': {
				const [ra, rb, rdest] = args;
				this.#reg[rdest] = this.#reg[ra] + this.#reg[rb];
			}
			break;
			case 'SUB': {
				const [ra, rb, rdest] = args;
				this.#reg[rdest] = this.#reg[ra] - this.#reg[rb];
			}
			break;
			case 'MUL': {
				const [ra, rb, rdest] = args;
				this.#reg[rdest] = this.#reg[ra] * this.#reg[rb];
			}
			break;
			case 'DIV': {
				const [ra, rb, rdest] = args;
				this.#reg[rdest] = Math.floor(this.#reg[ra] / this.#reg[rb]);
			}
			break;
			case 'MOD': {
				const [ra, rb, rdest] = args;
				this.#reg[rdest] = this.#reg[ra] % this.#reg[rb];
			}
			default:
				// currently there is no other possible instruction to by handled
				const { shouldJump, pc } = this.#alu(instruction, args);
				if (shouldJump) {
					this.#pc = pc;
					return;
				}
			break;
		}

		this.#pc++; // always increase program counter
	}

	/**
	 * Returns memory reference.
	 */
	memory() {
		return this.#mem;
	}

	/**
	 * Returns registers reference.
	 */
	registers() {
		return this.#reg;
	}

	run() {
		try {
			this.#executeAll();
		} catch (err) {
			console.error(err)
		}
	}

	runStep() {
		try {
			if (this.#pc < this.#program.length) this.#executeStep();
		} catch (err) {
			console.log(err);
		}
	}
}
